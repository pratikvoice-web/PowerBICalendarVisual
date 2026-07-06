import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;

import { CalendarEngine, CalendarDay } from "./calendarEngine";
import { VisualSettings } from "./formattingSettings";

interface ExtractedDataPoint {
    dateKey: string; // YYYY-MM-DD
    primaryValue: number;
    primaryValueText: string;
    secondaryMetrics: { label: string; valueText: string }[];
    selectionId: powerbi.visuals.ISelectionId;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private container: d3.Selection<HTMLDivElement, any, any, any>;
    private headerRow: d3.Selection<HTMLDivElement, any, any, any>;
    private gridContainer: d3.Selection<HTMLDivElement, any, any, any>;
    private settings: VisualSettings;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();

        // 1. Initialize master container div element
        this.container = d3.select(this.target)
            .append("div")
            .attr("class", "calendar-visual-container");

        // 2. Initialize header tracking day labels
        this.headerRow = this.container.append("div").attr("class", "calendar-header-row");
        const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        weekdays.forEach(day => this.headerRow.append("div").text(day));

        // 3. Initialize grid container layout
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

        // 1. Verify existence of required Date Category assignment
        if (!categorical.categories || !categorical.categories[0]) return;
        const dateCategory = categorical.categories[0];

        // 2. Parse out primary and continuous secondary measures arrays safely
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

        // 3. Extract execution values into a map dictionary
        const dataMap: { [key: string]: ExtractedDataPoint } = {};
        let globalMin = Infinity;
        let globalMax = -Infinity;
        let referenceYear = new Date().getFullYear();
        let referenceMonth = new Date().getMonth();
        let referenceDateFound = false;

        dateCategory.values.forEach((catValue, i) => {
            if (!catValue) return;
            const rawDate = new Date(<string>catValue);
            
            // Establish visual boundary coordinates based on first extracted valid timestamp context
            if (!referenceDateFound) {
                referenceYear = rawDate.getFullYear();
                referenceMonth = rawDate.getMonth();
                referenceDateFound = true;
            }

            const tzOffsetString = rawDate.toISOString().split("T")[0]; // Key form: YYYY-MM-DD
            
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

        // 4. Generate visual layout coordinates using the math engine
        const monthGridData = CalendarEngine.generateMonthGrid(referenceYear, referenceMonth);

        // 5. Construct D3 Linear Gradient Scale mapping
        if (globalMin === Infinity) globalMin = 0;
        if (globalMax === -Infinity) globalMax = 1;
        
        const colorScale = d3.scaleLinear<string>()
            .domain([globalMin, globalMax])
            .range([this.settings.calendarColors.minColor, this.settings.calendarColors.maxColor]);

        // 6. Bind data array to DOM grid container
        this.gridContainer.selectAll("*").remove();

        const cellsSelection = this.gridContainer
            .selectAll(".calendar-day-cell")
            .data(monthGridData)
            .enter()
            .append("div")
            .attr("class", d => d.dayNumber === 0 ? "calendar-day-cell empty-cell" : "calendar-day-cell");

        // 7. Inject metric structural text tracking into DOM elements
        cellsSelection.each((d: CalendarDay, i, nodes) => {
            const currentElement = d3.select(nodes[i]);
            if (d.dayNumber === 0 || !d.date) return;

            // Render top-right day label context
            currentElement.append("div")
                .attr("class", "day-number")
                .text(d.dayNumber);

            const matchKey = d.date.toISOString().split("T")[0];
            const metrics = dataMap[matchKey];

            if (metrics) {
                // Apply calculated threshold cell tinting
                if (metrics.primaryValue !== null) {
                    currentElement.style("background-color", colorScale(metrics.primaryValue));
                }

                // Append center stage label metrics
                currentElement.append("div")
                    .attr("class", "primary-measure-value")
                    .text(metrics.primaryValueText ? `₹${metrics.primaryValueText} Cr` : "");

                // Append bottom layout list tracking
                if (metrics.secondaryMetrics.length > 0) {
                    const metricsWrapper = currentElement.append("div").attr("class", "secondary-measures-list");
                    metrics.secondaryMetrics.forEach(m => {
                        const row = metricsWrapper.append("div").attr("class", "secondary-metric-row");
                        row.append("span").attr("class", "metric-label").text(`${m.label}:`);
                        row.append("span").attr("class", "metric-value").text(m.valueText);
                    });
                }

                // 8. Bind Selection Manager event hooks to handle cross-filtering natively
                currentElement.on("click", (event) => {
                    this.selectionManager.select(metrics.selectionId).then((ids) => {
                        this.syncSelectionState(nodes, ids, dataMap);
                    });
                    event.stopPropagation();
                });

                // 9. Wire native Tooltip Service interactions
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

        // Clear filter selection when canvas background space is clicked
        this.container.on("click", () => {
            this.selectionManager.clear().then(() => {
                d3.selectAll(".calendar-day-cell").style("opacity", 1.0);
            });
        });
    }

    private syncSelectionState(nodes: any, selectionIds: powerbi.visuals.ISelectionId[], dataMap: any) {
        if (!selectionIds || selectionIds.length === 0) {
            d3.selectAll(".calendar-day-cell").style("opacity", 1.0);
            return;
        }

        d3.selectAll(".calendar-day-cell").each((d: CalendarDay, idx, nList) => {
            if (d.dayNumber === 0 || !d.date) return;
            const matchKey = d.date.toISOString().split("T")[0];
            const metrics = dataMap[matchKey];

            if (metrics) {
                const isSelected = selectionIds.some(sid => sid.equals(metrics.selectionId));
                d3.select(nList[idx]).style("opacity", isSelected ? 1.0 : 0.3);
            }
        });
    }

    public enumerateVisualObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        const instances: powerbi.VisualObjectInstance[] = [];
        if (options.objectName === "calendarColors") {
            instances.push({
                objectName: "calendarColors",
                properties: {
                    minColor: this.settings.calendarColors.minColor,
                    maxColor: this.settings.calendarColors.maxColor
                },
                selector: null
            });
        }
        return instances;
    }
}
