# YesWiki Page Reader Specification

## Purpose

Provides search, raw content extraction, canonical URL resolution, and change feed monitoring across YesWiki pages.

## Requirements

### Requirement: Full-text and keyword page search
The tool `yeswiki_search_pages` SHALL execute keyword and full-text searches against the configured YesWiki instance and return matching pages with titles, snippets, and canonical links.

#### Scenario: Searching for laser cutter documentation
- **WHEN** the user asks about laser cutter guidelines and the tool `yeswiki_search_pages` is invoked with query "decoupeuse laser"
- **THEN** the server returns matching YesWiki page records containing page names, excerpt snippets, and canonical URLs (`https://labovilleurbanne.fr/yeswiki/?...`)

#### Scenario: Search with no matching results
- **WHEN** a search query matches zero wiki pages
- **THEN** the tool returns an empty result list without throwing an error

### Requirement: Page content and metadata retrieval
The tool `yeswiki_get_page` SHALL fetch raw wikitext, markdown, or cleaned plain text for a specified page name, along with metadata including last author and modification timestamp.

#### Scenario: Fetching existing wiki page
- **WHEN** `yeswiki_get_page` is invoked with `page_name: "SecuriteAtelier"`
- **THEN** the server retrieves the page content, cleans extraneous HTML tags, and returns the formatted text, last modification date, and canonical URL

#### Scenario: Fetching non-existent page
- **WHEN** `yeswiki_get_page` is invoked with a page name that does not exist on the wiki
- **THEN** the server returns an explicit error indicating that the requested page was not found

### Requirement: Recent changes feed monitoring
The tool `yeswiki_list_recent_changes` SHALL retrieve the list of most recently modified or created pages from the YesWiki RSS/Atom or history feed.

#### Scenario: Listing recent wiki activity
- **WHEN** `yeswiki_list_recent_changes` is invoked with `limit: 10`
- **THEN** the server returns an ordered list of the 10 most recent page modifications with author names and modification timestamps
