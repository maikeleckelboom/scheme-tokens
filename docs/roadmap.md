# Roadmap

Core `0.4.0` provides graph authoring, ordered composition, references and concat, per-mode
resolution, visibility, versioned artifacts, and CSS export. Material `0.2.0` supplies color
roles as a layer and requires core `^0.4.0`.

## Toward 1.0

The next major milestone is a stable public contract. Work toward it focuses on:

- keeping authoring, persisted formats, TypeScript inference, and CSS behavior consistent;
- resolving remaining API problems through concrete consumer examples;
- maintaining package, compiler, browser, and serialization checks;
- keeping guides and references aligned with the supported packages.

Consumer needs will determine further API changes. Repeated mode-authoring work or a need for
DTCG import may justify an extension when there is a concrete use case.

## Optional packages

Generators can return layers for core to compose. Material demonstrates this integration with
configurable modes, variants, and contrast. Its peer range records the supported core contract;
future range changes need compatibility evidence.

Release history is in [CHANGELOG.md](../CHANGELOG.md). Contributor checks and release mechanics
are described in [Development](./development.md).
