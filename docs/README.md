# Streamweave Docs

## Build and serve the docs site

From the repo root:

```bash
cd backend
uv sync
uv run python -m mkdocs serve -f ../mkdocs.yml
```

The site will be available at http://127.0.0.1:8000.

## Run the manual testing notebook

The notebook (`backend-demo.ipynb`) requires the full Docker stack to be running. It will take care of setting everything up using docker compose from within the repo From the repo root:

```bash
cd backend
uv sync
uv run jupyter lab ../docs/backend-demo.ipynb
```

Open the notebook in your browser and run cells top-to-bottom.
