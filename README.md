# README.md

## Calendar Grid Pro
An enterprise-grade, high-performance custom calendar visualisation for Power BI. Built natively using TypeScript and D3.js to bypass web-sandbox layout constraints, this visual forces a rigid, responsive Monday-to-Sunday grid that maps multi-measure metrics directly onto temporal coordinates.

---

## Core Capabilities

* **Fixed Monday-Start Grid:** Dynamically recalibrates calendar boundaries to force an intuitive Monday-through-Sunday structural grid layout.
* **Dual-Tier Metric Mapping:**
  * **Primary Measure:** Positioned center-stage with support for distinct data colour gradients mapped to global minimum and maximum thresholds.
  * **Secondary Metrics:** Renders non-distorting stacked arrays below the primary measure for multi-dimensional daily tracking.
* **Responsive Layout Safeguards:** Features native vertical scrollbar instantiation (`minmax` constraint logic) to prevent typography compression or layout overflows when handling dense metric sets.
* **Deep Power BI Integration:** * Full support for native Right-Click Context Menus, allowing seamless access to cross-report **Drillthrough** and operational page routing.
  * Bidirectional cross-visual filtering via the platform's native Selection Manager.
  * Dynamic metadata parsing to inherit user-configured decimals and format string parameters directly from the reporting layer.
* **Localisation Precision:** Hardcoded to support `en-IN` formatting natively, accurately handling metric scaling declarations (e.g., Lakhs and Crores).

---

## Target Audience & Operational Use Cases

### Who Should Use This Visual?
* **Operations & Supply Chain Analysts:** Designed for professionals monitoring high-velocity daily throughput, order dispatch trends, or delivery slot performance metrics.
* **Commercial & Revenue Managers:** Ideal for tracking daily revenue realization, margin leakage, and transactional volume spikes across business cycles.
* **Financial Controllers:** Built for auditing daily collections, working capital disbursements, or cash-flow fluctuations against rigid monthly targets.

### Primary Implementations
* **Logistics & Order Management:** Tracking **Daily Order Volume (Cr)** as the primary gradient anchor while cross-referencing **Average Order Value** and **Orders Count** as secondary baselines.
* **Retail & Digital Commerce Performance:** Monitoring daily active transactions and localized fulfillment status over a 30-day lookback window.
* **Manufacturing Output:** Mapping daily factory yield metrics and scrap percentage across specific shift schedules.

---

## Configuration & Field Mapping

To activate the layout engine, assign your dataset fields to the following visual drop-zones:

| Field Bucket | Expected Data Type | Functional Output |
| :--- | :--- | :--- |
| **Date Field** | Date / Timestamp | Establishes the core temporal grid. Uses the first index to determine month/year boundaries. |
| **Primary Measure (Center)** | Numeric Value | Governs the background color saturation scale. Centers text bolding. |
| **Secondary Measures** | Multi-Measure Collection | Appends vertical text arrays to the lower quadrant of each calendar cell. |

---

## Formatting Pane Properties

The visual exposes comprehensive configuration controls within the **Visual** properties pane:

### 1. Data Colors
* **Minimum Color:** Assigns the hex tint for the lowest recorded primary value in the filter context.
* **Maximum Color:** Assigns the hex tint for the highest recorded primary value in the filter context.

### 2. Calendar Headers
* Overrides typography for the top-level centered Month-Year banner and the individual weekday labels (**Mon** through **Sun**). Adjust Font Family, Text Size, Font Color, and background fills.

### 3. Grid and Cells
* Manages center-stage metrics. Configures primary numeric font styling, border grid visibility, line coloration, and cell divider thickness parameters.

### 4. Secondary Data Labels
* Features a hard toggle to hide or show secondary metric strings instantly, alongside standalone font size and color controls to ensure dashboard readability.
