import powerbi from "powerbi-visuals-api";

export class CalendarColorsSettings {
    public minColor: string = "#EF8E8E";
    public maxColor: string = "#4AE225";
}

export class HeaderSettings {
    public fontFamily: string = "Segoe UI, Arial, sans-serif";
    public fontSize: number = 12;
    public fontColor: string = "#323130";
    public backgroundColor: string = "#f3f2f1";
}

export class CellSettings {
    public fontFamily: string = "Segoe UI, Arial, sans-serif";
    public fontSize: number = 14;
    public fontColor: string = "#111111";
    public borderColor: string = "#d2d0ce";
    public borderThickness: number = 1;
}

export class LabelSettings {
    public show: boolean = true;
    public fontSize: number = 9;
    public fontColor: string = "#555555";
}

export class VisualSettings {
    public calendarColors: CalendarColorsSettings = new CalendarColorsSettings();
    public headerSettings: HeaderSettings = new HeaderSettings();
    public cellSettings: CellSettings = new CellSettings();
    public labelSettings: LabelSettings = new LabelSettings();

    public static parse(dataView: powerbi.DataView): VisualSettings {
        const settings = new VisualSettings();
        if (!dataView || !dataView.metadata || !dataView.metadata.objects) {
            return settings;
        }

        const objects = dataView.metadata.objects;

        if (objects.calendarColors) {
            const obj = objects.calendarColors;
            if (obj.minColor?.["solid"]) settings.calendarColors.minColor = obj.minColor["solid"]["color"];
            if (obj.maxColor?.["solid"]) settings.calendarColors.maxColor = obj.maxColor["solid"]["color"];
        }

        if (objects.headerSettings) {
            const obj = objects.headerSettings;
            if (obj.fontFamily) settings.headerSettings.fontFamily = <string>obj.fontFamily;
            if (obj.fontSize) settings.headerSettings.fontSize = <number>obj.fontSize;
            if (obj.fontColor?.["solid"]) settings.headerSettings.fontColor = obj.fontColor["solid"]["color"];
            if (obj.backgroundColor?.["solid"]) settings.headerSettings.backgroundColor = obj.backgroundColor["solid"]["color"];
        }

        if (objects.cellSettings) {
            const obj = objects.cellSettings;
            if (obj.fontFamily) settings.cellSettings.fontFamily = <string>obj.fontFamily;
            if (obj.fontSize) settings.cellSettings.fontSize = <number>obj.fontSize;
            if (obj.fontColor?.["solid"]) settings.cellSettings.fontColor = obj.fontColor["solid"]["color"];
            if (obj.borderColor?.["solid"]) settings.cellSettings.borderColor = obj.borderColor["solid"]["color"];
            if (obj.borderThickness !== undefined) settings.cellSettings.borderThickness = <number>obj.borderThickness;
        }

        if (objects.labelSettings) {
            const obj = objects.labelSettings;
            if (obj.show !== undefined) settings.labelSettings.show = <boolean>obj.show;
            if (obj.fontSize) settings.labelSettings.fontSize = <number>obj.fontSize;
            if (obj.fontColor?.["solid"]) settings.labelSettings.fontColor = obj.fontColor["solid"]["color"];
        }

        return settings;
    }
}
