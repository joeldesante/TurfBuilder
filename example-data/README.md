# Example Data

Sample CSV files for testing the Universe Data Manager import feature.

## Files

### people.csv

1,000 rows of fictional individuals. Upload via the Universe Data Manager "People" import button.

Columns: `first_name`, `last_name`, `middle_name`, `suffix`, `email`, `phone`, `dob`, `gender`

- `dob` is in `YYYY-MM-DD` format as required by the importer.
- `email`, `phone`, `middle_name`, `suffix`, and `gender` are intentionally sparse to reflect real-world data quality.

### locations.csv

1,000 rows of fictional Illinois addresses. Upload via the Universe Data Manager "Locations" import button.

Columns: `name`, `address_line_1`, `address_line_2`, `city`, `state_or_region`, `postal_code`, `country_code`

- Addresses are spread across Chicago and surrounding suburbs.
- `name` (building/unit name) and `address_line_2` (unit number) are present on a subset of rows.
- `country_code` is `US` throughout.

## Usage

1. Navigate to your org's Universe Data Manager (Staff panel - Universe - Data Manager).
2. Click "Import CSV" under People and select `people.csv`.
3. Click "Import CSV" under Locations and select `locations.csv`.
