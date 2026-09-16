# YesWiki Bazar Reader Specification

## Purpose

Provides structured queries, card extraction, and inventory status inspection for YesWiki Bazar forms, machine directories, and project records.

## Requirements

### Requirement: Structured Bazar entries extraction
The tool `yeswiki_get_bazar_entries` SHALL query YesWiki Bazar forms or JSON endpoints and return normalized records with structured fields (title, category, description, tags, custom form values).

#### Scenario: Querying fablab machines directory
- **WHEN** `yeswiki_get_bazar_entries` is called with `form_id: "machines"` or `category: "equipement"`
- **THEN** the server returns an array of structured machine records containing name, status, material compatibility, and documentation links

#### Scenario: Filtering Bazar records by category
- **WHEN** `yeswiki_get_bazar_entries` is invoked with a specific category filter
- **THEN** only entries matching the specified category are included in the returned dataset

### Requirement: Machine status and operational query
The tool `yeswiki_get_machine_status` SHALL inspect specific machine records and return real-time operational availability, maintenance status, and mandatory safety guidelines.

#### Scenario: Querying status of a specific 3D printer
- **WHEN** `yeswiki_get_machine_status` is invoked with `machine_name: "Prusa MK3S"`
- **THEN** the server retrieves the machine's current operational state (available, in maintenance, reserved), supported filaments, and direct link to its wiki guide
