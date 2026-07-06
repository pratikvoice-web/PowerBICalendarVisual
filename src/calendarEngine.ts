export interface CalendarDay {
    dayNumber: number; // 1-31, or 0 for empty padding cells
    date: Date | null;
    isCurrentMonth: boolean;
}

export class CalendarEngine {
    /**
     * Generates a flat array of exactly 35 or 42 days representing the calendar grid
     * for a given month and year, locked to a Monday start.
     */
    public static generateMonthGrid(year: number, month: number): CalendarDay[] {
        const grid: CalendarDay[] = [];
        
        // First day of the target month
        const firstDayOfMonth = new Date(year, month, 1);
        // Last day of the target month
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const totalDaysInMonth = lastDayOfMonth.getDate();

        // Get day of week for the 1st (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        let startDayOfWeek = firstDayOfMonth.getDay();
        
        // Shift index so Monday is 0, Sunday is 6
        let mondayShiftedIndex = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

        // 1. Append padding cells for leading empty days from previous month context
        for (let i = 0; i < mondayShiftedIndex; i++) {
            grid.push({
                dayNumber: 0,
                date: null,
                isCurrentMonth: false
            });
        }

        // 2. Append active days of the current month
        for (let day = 1; day <= totalDaysInMonth; day++) {
            grid.push({
                dayNumber: day,
                date: new Date(year, month, day),
                isCurrentMonth: true
            });
        }

        // 3. Append trailing padding cells to round out the final 7-column grid row
        const remainingCells = grid.length % 7;
        if (remainingCells !== 0) {
            const trailingPadding = 7 - remainingCells;
            for (let i = 0; i < trailingPadding; i++) {
                grid.push({
                    dayNumber: 0,
                    date: null,
                    isCurrentMonth: false
                });
            }
        }

        return grid;
    }
}
