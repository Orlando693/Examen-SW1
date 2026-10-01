## MODIFIED Requirements

### Requirement: Generated frontend output is deterministic and executable
The system SHALL produce identical generated frontend paths and contents for equivalent OpenAPI, Domain Manifest, and generation options. The generated frontend SHALL include a single `NEXT_PUBLIC_API_BASE_URL` configuration boundary with `http://localhost:8080` as its local fallback, an `.env.example`, and a concise README explaining installation, API configuration, development startup, and the local browser URL. The known generated frontend SHALL install, typecheck, test, build, and complete real-browser CRUD verification against the known generated backend.

#### Scenario: Regenerated frontend is equivalent
- **WHEN** the same generated contracts are materialized twice in separate output roots
- **THEN** their relative paths, content hashes, configuration example, and README are identical and each generated project completes its required install, typecheck, test, and build checks

#### Scenario: User configures a generated frontend locally
- **WHEN** a user extracts a generated frontend and points it at a local generated Spring backend
- **THEN** the README and `.env.example` identify `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`, and the generated HTTP layer uses that configuration rather than entity-specific URLs
