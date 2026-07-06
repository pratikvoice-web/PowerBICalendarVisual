import powerbi from "powerbi-visuals-api";

export class CalendarColorsSettings {
    public minColor: string = "#EF8E8E"; // Default soft red
    public maxColor: string = "#4AE225"; // Default vibrant green
}

export class VisualSettings {
    public calendarColors: CalendarColorsSettings = new CalendarColorsSettings();

    public static parse(dataView: powerbi.DataView): VisualSettings {
        const settings = new VisualSettings();
        if (!dataView || !dataView.metadata || !dataView.metadata.objects) {
            return settings;
        }

        const objects = dataView.metadata.objects;
        if (objects.calendarColors) {
            const colorCard = objects.calendarColors;
            if (colorCard.minColor && colorCard.minColor["solid"]) {
                settings.calendarColors.minColor = colorCard.minColor["solid"]["color"];
            }
            if (colorCard.maxColor && colorCard.maxColor["solid"]) {
                settings.calendarColors.maxColor = colorCard.maxColor["solid"]["color"];
            }
        }
        return settings;
    }
}
