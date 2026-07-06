declare var require: any;
const d3: any = require("d3");
import powerbi from "powerbi-visuals-api";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { CalendarEngine, CalendarDay } from "./calendarEngine";
import { VisualSettings } from "./formattingSettings";

interface ExtractedDataPoint {
    dateKey: string;
    primaryValue: number;
    primaryValueText: string;
    secondaryMetrics: { label: string; valueText: string }[];
    selectionId: powerbi.visuals.ISelectionId;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private container: any;
    private headerRow: any;
    private gridContainer: any;
    private settings: VisualSettings;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();

        this.container = d3.select(this.target)
            .append("div")
            .attr("class", "calendar-visual-container");

        this.headerRow = this.container.append("div").attr("class", "calendar-header-row");
        const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        weekdays.forEach(day => this.headerRow.append("div").text(day));

        this.gridContainer = this.container.append("div").attr("class", "calendar-grid");
    }

    private injectDynamicStyles() {
        let styleElement = document.getElementById("pbi-calendar-runtime-styles");
        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "pbi-calendar-runtime-styles";
            document.head.appendChild(styleElement);
        }

        const h = this.settings.headerSettings;
        const c = this.settings.cellSettings;
        const l = this.settings.labelSettings;

        styleElement.innerHTML = `
            .calendar-visual-container {
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                box-sizing: border-box !important;
            }
            .calendar-header-row {
                display: grid !important;
                grid-template-columns: repeat(7, 1fr) !important;
                text-align: center !important;
                font-family: ${h.fontFamily} !important;
                font-size: ${h.fontSize}px !important;
                background-color: ${h.backgroundColor} !important;
                border-bottom: ${c.borderThickness}px solid ${c.borderColor} !important;
                padding: 6px 0 !important;
            }
            .calendar-header-row div {
                color: ${h.fontColor} !important;
                font-weight: 600 !important;
            }
            .calendar-grid {
                display: grid !important;
                grid-template-columns: repeat(7, 1fr) !important;
                grid-auto-rows: 1fr !important;
                flex-grow: 1 !important;
                gap: ${c.borderThickness}px !important;
                background-color: ${c.borderColor} !important;
                border: ${c.borderThickness}px solid ${c.borderColor} !important;
            }
            .calendar-day-cell {
                background-color: #ffffff !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                padding: 6px !important;
                box-sizing: border-box !important;
                position: relative !important;
            }
            .empty-cell {
                background-color: #faf9f8 !important;
            }
            .day-number {
                align-self: flex-end !important;
                font-size: 10px !important;
                font-weight: 600 !important;
                color: #605e5c !important;
            }
            .primary-measure-value {
                font-family: ${c.fontFamily} !important;
                font-size: ${c.fontSize}px !important;
                color: ${c.fontColor} !important;
                font-weight: 700 !important;
                text-align: center !important;
                margin: auto 0 !important;
                word-break: break-word !important;
            }
            .secondary-measures-list {
                display: ${l.show ? "flex" : "none"} !important;
                flex-direction: column !important;
                gap: 2px !important;
                font-size: ${l.fontSize}px !important;
                color: ${l.fontColor} !important;
                border-top: 1px solid rgba(0,0,0,0.05) !important;
                padding-top: 4px !important;
            }
            .secondary-metric-row {
                display: flex !important;
                justify-content: space-between !important;
            }
        `;
    }

    public update(options: VisualUpdateOptions) {
        if (!options.dataViews || !options.dataViews[0] || !options.dataViews[0].categorical) {
            this.gridContainer.selectAll("*").remove();
            return;
        }

        const dataView = options.dataViews[0];
        const categorical = dataView.categorical;
        this.settings = VisualSettings.parse(dataView);

        // Inject compiled runtime layout adjustments
        this.injectDynamicStyles();

        if (!categorical.categories || !categorical.categories[0]) return;
        const dateCategory = categorical.categories[0];

        const valuesMetadata = categorical.values || [];
        let primaryMeasureIndex = -1;
        const secondaryMeasureIndices: number[] = [];

        valuesMetadata.forEach((valGroup, idx) => {
            if (valGroup.source.roles["primaryMeasure"]) {
                primaryMeasureIndex = idx;
            } else if (valGroup.source.roles["secondaryMeasures"]) {
                secondaryMeasureIndices.push(idx);
            }
        });

        const dataMap: { [key: string]: ExtractedDataPoint } = {};
        let globalMin = Infinity;
        let globalMax = -Infinity;
        let referenceYear = new Date().getFullYear();
        let referenceMonth = new Date().getMonth();
        let referenceDateFound = false;

        dateCategory.values.forEach((catValue, i) => {
            if (!catValue) return;
            const rawDate = new Date(<string>catValue);
            
            if (!referenceDateFound) {
                referenceYear = rawDate.getFullYear();
                referenceMonth = rawDate.getMonth();
                referenceDateFound = true;
            }

            const tzOffsetString = rawDate.toISOString().split("T")[0];
            
            let primaryValue = null;
            let primaryValueText = "";
            
            if (primaryMeasureIndex !== -1 && categorical.values[primaryMeasureIndex].values[i] !== null) {
                primaryValue = <number>categorical.values[primaryMeasureIndex].values[i];
                primaryValueText = primaryValue.toLocaleString("en-IN", { maximumFractionDigits: 2 });
                
                if (primaryValue < globalMin) globalMin = primaryValue;
                if (primaryValue > globalMax) globalMax = primaryValue;
            }

            const secondaryMetrics: { label: string; valueText: string }[] = [];
            secondaryMeasureIndices.forEach(idx => {
                const measureGroup = categorical.values[idx];
                const rawVal = measureGroup.values[i];
                if (rawVal !== null) {
                    secondaryMetrics.push({
                        label: measureGroup.source.displayName,
                        valueText: typeof rawVal === "number" ? rawVal.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : <string>rawVal
                    });
                }
            });

            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(dateCategory, i)
                .createSelectionId();

            dataMap[tzOffsetString] = {
                dateKey: tzOffsetString,
                primaryValue,
                primaryValueText,
                secondaryMetrics,
                selectionId
            };
        });

        const monthGridData = CalendarEngine.generateMonthGrid(referenceYear, referenceMonth);

        if (globalMin === Infinity) globalMin = 0;
        if (globalMax === -Infinity) globalMax = 1;
        
        const colorScale = d3.scaleLinear()
            .domain([globalMin, globalMax])
            .range([this.settings.calendarColors.minColor, this.settings.calendarColors.maxColor]);

        this.gridContainer.selectAll("*").remove();

        const cellsSelection = this.gridContainer
            .selectAll(".calendar-day-cell")
            .data(monthGridData)
            .enter()
            .append("div")
            .attr("class", d => d.dayNumber === 0 ? "calendar-day-cell empty-cell" : "calendar-day-cell");

        cellsSelection.each((d: CalendarDay, i, nodes) => {
            const currentElement = d3.select(nodes[i]);
            if (d.dayNumber === 0 || !d.date) return;

            currentElement.append("div")
                .attr("class", "day-number")
                .text(d.dayNumber);

            const matchKey = d.date.toISOString().split("T")[0];
            const metrics = dataMap[matchKey];

            if (metrics) {
                if (metrics.primaryValue !== null) {
                    currentElement.style("background-color", colorScale(metrics.primaryValue));
                }

                currentElement.append("div")
                    .attr("class", "primary-measure-value")
                    .text(metrics.primaryValueText ? `₹${metrics.primaryValueText} Cr` : "");

                if (metrics.secondaryMetrics.length > 0) {
                    const metricsWrapper = currentElement.append("div").attr("class", "secondary-measures-list");
                    metrics.secondaryMetrics.forEach(m => {
                        const row = metricsWrapper.append("div").attr("class", "secondary-metric-row");
                        row.append("span").attr("class", "metric-label").text(`${m.label} `);
                        row.append("span").attr("class", "metric-value").text(m.valueText);
                    });
                }

                currentElement.on("click", (event) => {
                    this.selectionManager.select(metrics.selectionId).then((ids) => {
                        this.syncSelectionState(nodes, ids, dataMap);
                    });
                    event.stopPropagation();
                });

                currentElement.on("contextmenu", (event) => {
                    this.selectionManager.showContextMenu(metrics.selectionId, {
                        x: event.clientX,
                        y: event.clientY
                    });
                    event.preventDefault();
                    event.stopPropagation();
                });

                currentElement.on("mouseover", (event) => {
                    const tooltipItems = [
                        { displayName: "Date", value: d.date.toLocaleDateString("en-IN") },
                        { displayName: "Primary Metric", value: metrics.primaryValueText || "No Data" }
                    ];
                    metrics.secondaryMetrics.forEach(sm => {
                        tooltipItems.push({ displayName: sm.label, value: sm.valueText });
                    });

                    this.host.tooltipService.show({
                        coordinates: [event.clientX, event.clientY],
                        isTouchEvent: false,
                        dataItems: tooltipItems,
                        identities: [metrics.selectionId]
                    });
                });

                currentElement.on("mousemove", (event) => {
                    this.host.tooltipService.move({
                        coordinates: [event.clientX, event.clientY],
                        isTouchEvent: false,
                        dataItems: [],
                        identities: [metrics.selectionId]
                    });
                });

                currentElement.on("mouseout", () => {
                    this.host.tooltipService.hide({ isTouchEvent: false, immediately: true });
                });
            }
        });

        this.container.on("click", () => {
            this.selectionManager.clear().then(() => {
                d3.selectAll(".calendar-day-cell").style("opacity", 1.0);
            });
        });
    }

    private syncSelectionState(nodes: any, selectionIds: any[], dataMap: any) {
        if (!selectionIds || selectionIds.length === 0) {
            d3.selectAll(".calendar-day-cell").style("opacity", 1.0);
            return;
        }

        d3.selectAll(".calendar-day-cell").each((d: CalendarDay, idx, nList) => {
            if (d.dayNumber === 0 || !d.date) return;
            const matchKey = d.date.toISOString().split("T")[0];
            const metrics = dataMap[matchKey];

            if (metrics) {
                const isSelected = selectionIds.some(sid => (sid as any).equals(metrics.selectionId));
                d3.select(nList[idx]).style("opacity", isSelected ? 1.0 : 0.3);
            }
        });
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const s = this.settings;

        const colorCard: powerbi.visuals.FormattingCard = {
            displayName: "Data Colors",
            uid: "calendarColorsCard_uid",
            groups: [{
                displayName: "Gradient Thresholds",
                uid: "calendarColorsGroup_uid",
                slices: [
                    {
                        displayName: "Minimum Color",
                        uid: "minColor_slice_uid",
                        control: { type: "ColorPicker", properties: { descriptor: { objectName: "calendarColors", propertyName: "minColor" }, value: { value: s.calendarColors.minColor } } }
                    },
                    {
                        displayName: "Maximum Color",
                        uid: "maxColor_slice_uid",
                        control: { type: "ColorPicker", properties: { descriptor: { objectName: "calendarColors", propertyName: "maxColor" }, value: { value: s.calendarColors.maxColor } } }
                    }
                ]
            }]
        };

        const headerCard: powerbi.visuals.FormattingCard = {
            displayName: "Calendar Headers",
            uid: "headerSettingsCard_uid",
            groups: [{
                displayName: "Typography & Fill",
                uid: "headerSettingsGroup_uid",
                slices: [
                    {
                        displayName: "Font Family",
                        uid: "headerFontFamily_slice_uid",
                        control: { type: "FontPicker", properties: { descriptor: { objectName: "headerSettings", propertyName: "fontFamily" }, value: s.headerSettings.fontFamily } }
                    },
                    {
                        displayName: "Text Size",
                        uid: "headerFontSize_slice_uid",
                        control: { type: "NumUpAndDown", properties: { descriptor: { objectName: "headerSettings", propertyName: "fontSize" }, value: s.headerSettings.fontSize } }
                    },
                    {
                        displayName: "Font Color",
                        uid: "headerFontColor_slice_uid",
                        control: { type: "ColorPicker", properties: { descriptor: { objectName: "headerSettings", propertyName: "fontColor" }, value: { value: s.headerSettings.fontColor } } }
                    },
                    {
                        displayName: "Background Color",
                        uid: "headerBgColor_slice_uid",
                        control: { type: "ColorPicker", properties: { descriptor: { objectName: "headerSettings", propertyName: "backgroundColor" }, value: { value: s.headerSettings.backgroundColor } } }
                    }
                ]
            }]
        };

        const cellCard: powerbi.visuals.FormattingCard = {
            displayName: "Grid and Cells",
            uid: "cellSettingsCard_uid",
            groups: [{
                displayName: "Cell Settings",
                uid: "cellSettingsGroup_uid",
                slices: [
                    {
                        displayName: "Font Family",
                        uid: "cellFontFamily_slice_uid",
                        control: { type: "FontPicker", properties: { descriptor: { objectName: "cellSettings", propertyName: "fontFamily" }, value: s.cellSettings.fontFamily } }
                    },
                    {
                        displayName: "Primary Text Size",
                        uid: "cellFontSize_slice_uid",
                        control: { type: "NumUpAndDown", properties: { descriptor: { objectName: "cellSettings", propertyName: "fontSize" }, value: s.cellSettings.fontSize } }
                    },
                    {
                        displayName: "Primary Color",
                        uid: "cellFontColor_slice_uid",
                        control: { type: "ColorPicker", properties: { descriptor: { objectName: "cellSettings", propertyName: "fontColor" }, value: { value: s.cellSettings.fontColor } } }
                    },
                    {
                        displayName: "Border Color",
                        uid: "cellBorderColor_slice_uid",
                        control: { type: "ColorPicker", properties: { descriptor: { objectName: "cellSettings", propertyName: "borderColor" }, value: { value: s.cellSettings.borderColor } } }
                    },
                    {
                        displayName: "Border Thickness",
                        uid: "cellBorderThickness_slice_uid",
                        control: { type: "NumUpAndDown", properties: { descriptor: { objectName: "cellSettings", propertyName: "borderThickness" }, value: s.cellSettings.borderThickness } }
                    }
                ]
            }]
        };

        const labelCard: powerbi.visuals.FormattingCard = {
            displayName: "Secondary Data Labels",
            uid: "labelSettingsCard_uid",
            groups: [{
                displayName: "Label Properties",
                uid: "labelSettingsGroup_uid",
                slices: [
                    {
                        displayName: "Show Labels",
                        uid: "labelShow_slice_uid",
                        control: { type: "ToggleSwitch", properties: { descriptor: { objectName: "labelSettings", propertyName: "show" }, value: s.labelSettings.show } }
                    },
                    {
                        displayName: "Label Size",
                        uid: "labelFontSize_slice_uid",
                        control: { type: "NumUpAndDown", properties: { descriptor: { objectName: "labelSettings", propertyName: "fontSize" }, value: s.labelSettings.fontSize } }
                    },
                    {
                        displayName: "Label Color",
                        uid: "labelFontColor_slice_uid",
                        control: { type: "ColorPicker", properties: { descriptor: { objectName: "labelSettings", propertyName: "fontColor" }, value: { value: s.labelSettings.fontColor } } }
                    }
                ]
            }]
        };

        return {
            cards: [colorCard, headerCard, cellCard, labelCard]
        };
    }
}
