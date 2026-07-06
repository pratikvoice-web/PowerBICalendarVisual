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
    private titleHeader: any;
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

        // Centered dynamic MMMM-YYYY title element insertion point
        this.titleHeader = this.container.append("div")
            .attr("class", "calendar-title-header");

        this.headerRow = this.container.append("div").attr("class", "calendar-header-row");
        const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        weekdays.forEach(day => this.headerRow.append("div").text(day));

        this.gridContainer = this.container.append("div").attr("class", "calendar-grid");
    }

    public update(options: VisualUpdateOptions) {
        if (!options.dataViews || !options.dataViews[0] || !options.dataViews[0].categorical) {
            this.gridContainer.selectAll("*").remove();
            return;
        }

        const dataView = options.dataViews[0];
        const categorical = dataView.categorical;
        this.settings = VisualSettings.parse(dataView);

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

        const h = this.settings.headerSettings;
        const c = this.settings.cellSettings;
        const l = this.settings.labelSettings;

        // Render Centered MMMM-YYYY Header Text dynamically
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        this.titleHeader
            .text(`${monthNames[referenceMonth]} ${referenceYear}`)
            .style("text-align", "center")
            .style("font-family", h.fontFamily)
            .style("font-size", `${h.fontSize + 4}px`)
            .style("font-weight", "700")
            .style("color", h.fontColor)
            .style("background-color", h.backgroundColor)
            .style("padding", "10px 0")
            .style("text-transform", "uppercase")
            .style("letter-spacing", "0.5px")
            .style("flex-shrink", "0");

        this.container
            .style("width", "100%")
            .style("height", "100%")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("box-sizing", "border-box")
            .style("overflow-y", "auto");

        this.headerRow
            .style("display", "grid")
            .style("grid-template-columns", "repeat(7, 1fr)")
            .style("text-align", "center")
            .style("font-family", h.fontFamily)
            .style("font-size", `${h.fontSize}px`)
            .style("background-color", h.backgroundColor)
            .style("border-bottom", `${c.borderThickness}px solid ${c.borderColor}`)
            .style("padding", "8px 0")
            .style("flex-shrink", "0");

        this.headerRow.selectAll("div")
            .style("color", h.fontColor)
            .style("font-weight", "600");

        this.gridContainer
            .style("display", "grid")
            .style("grid-template-columns", "repeat(7, 1fr)")
            .style("grid-auto-rows", "minmax(105px, 1fr)")
            .style("flex-grow", "1")
            .style("gap", `${c.borderThickness}px`)
            .style("background-color", c.borderColor)
            .style("border", `${c.borderThickness}px solid ${c.borderColor}`);

        this.gridContainer.selectAll("*").remove();

        const cellsSelection = this.gridContainer
            .selectAll(".calendar-day-cell")
            .data(monthGridData)
            .enter()
            .append("div")
            .attr("class", d => d.dayNumber === 0 ? "calendar-day-cell empty-cell" : "calendar-day-cell")
            .style("background-color", d => d.dayNumber === 0 ? "#faf9f8" : "#ffffff")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("justify-content", "space-between")
            .style("padding", "6px")
            .style("box-sizing", "border-box")
            .style("position", "relative")
            .style("transition", "opacity 0.15s ease-in-out");

        cellsSelection.each((d: CalendarDay, i, nodes) => {
            const currentElement = d3.select(nodes[i]);
            if (d.dayNumber === 0 || !d.date) return;

            currentElement.append("div")
                .attr("class", "day-number")
                .style("align-self", "flex-end")
                .style("font-size", "11px")
                .style("font-weight", "600")
                .style("color", "#323130")
                .text(d.dayNumber);

            const matchKey = d.date.toISOString().split("T")[0];
            const metrics = dataMap[matchKey];

            if (metrics) {
                if (metrics.primaryValue !== null) {
                    currentElement.style("background-color", colorScale(metrics.primaryValue));
                }

                currentElement.append("div")
                    .attr("class", "primary-measure-value")
                    .style("font-family", c.fontFamily)
                    .style("font-size", `${c.fontSize}px`)
                    .style("color", c.fontColor)
                    .style("font-weight", "700")
                    .style("text-align", "center")
                    .style("margin", "auto 0")
                    .style("word-break", "break-word")
                    .text(metrics.primaryValueText ? `₹${metrics.primaryValueText} Cr` : "");

                if (metrics.secondaryMetrics.length > 0) {
                    const metricsWrapper = currentElement.append("div")
                        .attr("class", "secondary-measures-list")
                        .style("display", l.show ? "flex" : "none")
                        .style("flex-direction", "column")
                        .style("gap", "2px")
                        .style("font-size", `${l.fontSize}px`)
                        .style("color", l.fontColor)
                        .style("border-top", "1px solid rgba(0,0,0,0.05)")
                        .style("padding-top", "4px");

                    metrics.secondaryMetrics.forEach(m => {
                        const row = metricsWrapper.append("div")
                            .attr("class", "secondary-metric-row")
                            .style("display", "flex")
                            .style("justify-content", "space-between");

                        row.append("span").style("font-weight", "600").text(`${m.label} `);
                        row.append("span").style("font-weight", "700").style("color", "#222222").text(m.valueText);
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

    // MODERN FORMATTING MODEL - Cleanly structured with explicit '<any>' control mapping targets
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const s = this.settings;

        const colorCard: powerbi.visuals.FormattingCard = {
            displayName: "Data Colors",
            uid: "calendarColorsCard_uid",
            groups: [{
                displayName: "Gradient Range",
                uid: "calendarColorsGroup_uid",
                slices: [
                    { displayName: "Minimum Color", uid: "minColor_slice_uid", control: <any>{ type: "ColorPicker", properties: { descriptor: { objectName: "calendarColors", propertyName: "minColor" }, value: { value: s.calendarColors.minColor } } } },
                    { displayName: "Maximum Color", uid: "maxColor_slice_uid", control: <any>{ type: "ColorPicker", properties: { descriptor: { objectName: "calendarColors", propertyName: "maxColor" }, value: { value: s.calendarColors.maxColor } } } }
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
                    { displayName: "Font Family", uid: "headerFontFamily_slice_uid", control: <any>{ type: "FontPicker", properties: { descriptor: { objectName: "headerSettings", propertyName: "fontFamily" }, value: s.headerSettings.fontFamily } } },
                    { displayName: "Text Size", uid: "headerFontSize_slice_uid", control: <any>{ type: "NumUpDown", properties: { descriptor: { objectName: "headerSettings", propertyName: "fontSize" }, value: s.headerSettings.fontSize } } },
                    { displayName: "Font Color", uid: "headerFontColor_slice_uid", control: <any>{ type: "ColorPicker", properties: { descriptor: { objectName: "headerSettings", propertyName: "fontColor" }, value: { value: s.headerSettings.fontColor } } } },
                    { displayName: "Background Color", uid: "headerBgColor_slice_uid", control: <any>{ type: "ColorPicker", properties: { descriptor: { objectName: "headerSettings", propertyName: "backgroundColor" }, value: { value: s.headerSettings.backgroundColor } } } }
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
                    { displayName: "Font Family", uid: "cellFontFamily_slice_uid", control: <any>{ type: "FontPicker", properties: { descriptor: { objectName: "cellSettings", propertyName: "fontFamily" }, value: s.cellSettings.fontFamily } } },
                    { displayName: "Primary Text Size", uid: "cellFontSize_slice_uid", control: <any>{ type: "NumUpDown", properties: { descriptor: { objectName: "cellSettings", propertyName: "fontSize" }, value: s.cellSettings.fontSize } } },
                    { displayName: "Primary Color", uid: "cellFontColor_slice_uid", control: <any>{ type: "ColorPicker", properties: { descriptor: { objectName: "cellSettings", propertyName: "fontColor" }, value: { value: s.cellSettings.fontColor } } } },
                    { displayName: "Border Color", uid: "cellBorderColor_slice_uid", control: <any>{ type: "ColorPicker", properties: { descriptor: { objectName: "cellSettings", propertyName: "borderColor" }, value: { value: s.cellSettings.borderColor } } } },
                    { displayName: "Border Thickness", uid: "cellBorderThickness_slice_uid", control: <any>{ type: "NumUpDown", properties: { descriptor: { objectName: "cellSettings", propertyName: "borderThickness" }, value: s.cellSettings.borderThickness } } }
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
                    { displayName: "Show Labels", uid: "labelShow_slice_uid", control: <any>{ type: "ToggleSwitch", properties: { descriptor: { objectName: "labelSettings", propertyName: "show" }, value: s.labelSettings.show } } },
                    { displayName: "Label Size", uid: "labelFontSize_slice_uid", control: <any>{ type: "NumUpDown", properties: { descriptor: { objectName: "labelSettings", propertyName: "fontSize" }, value: s.labelSettings.fontSize } } },
                    { displayName: "Label Color", uid: "labelFontColor_slice_uid", control: <any>{ type: "ColorPicker", properties: { descriptor: { objectName: "labelSettings", propertyName: "fontColor" }, value: { value: s.labelSettings.fontColor } } } }
                ]
            }]
        };

        return {
            cards: [colorCard, headerCard, cellCard, labelCard]
        };
    }
}
