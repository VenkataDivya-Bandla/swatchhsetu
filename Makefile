# SwachhSetu prototype. Run `make help` for the list.
BASE ?= http://localhost:8000
PG_URL ?= postgresql://swachh:swachh@localhost:5432/swachhsetu

help:  ## List commands
	@grep -E '^[a-z-]+:.*##' Makefile | sed 's/:.*## /\t/'

setup:  ## Install backend, frontend and capture dependencies
	pip install -r backend/requirements.txt
	cd frontend && npm ci
	cd scripts/capture && npm install && npx playwright install --with-deps chromium

build:  ## Build the web app into frontend/dist
	cd frontend && npm run build

run: build  ## Build, then serve app + API on port 8000 (SQLite, zero setup)
	cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000

dev:  ## Hot-reload: API on 8000 and Vite on 5173 (open 5173)
	(cd backend && uvicorn app.main:app --reload --port 8000) & (cd frontend && npm run dev)

db-up:  ## Start PostgreSQL 16 in Docker
	docker compose up -d db

run-pg: build db-up  ## Serve using PostgreSQL instead of SQLite
	sleep 3 && cd backend && DATABASE_URL=$(PG_URL) uvicorn app.main:app --host 0.0.0.0 --port 8000

test:  ## Automated tests (full scenario + database rule)
	cd backend && rm -f test_swachhsetu.db && python -m pytest -q tests && rm -f test_swachhsetu.db

demo-report:  ## Run the scenario against BASE and write captures/demo-report.md
	python scripts/demo_report.py $(BASE)

capture:  ## Drive the demo in a browser: screenshots + phone recordings into captures/
	cd scripts/capture && BASE=$(BASE) node capture.mjs

video:  ## Join the phone recordings into captures/walkthrough.mp4 (needs ffmpeg)
	ffmpeg -y -i captures/video/phone-1-pilgrim.webm -i captures/video/phone-2-worker-eswar.webm -i captures/video/phone-3-worker-durga.webm \
	  -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p captures/walkthrough.mp4

evidence: demo-report capture  ## Report + screenshots + recordings in one go (server must be running)

reset:  ## Restore demo data on a running server
	curl -s -X POST $(BASE)/api/demo/reset -H "Authorization: Bearer $$(curl -s -X POST $(BASE)/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","pin":"1234"}' | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')"; echo

clean:  ## Remove local database, build output and captures
	rm -rf backend/swachhsetu.db frontend/dist captures/screens captures/video captures/*.md captures/*.mp4

.PHONY: help setup build run dev db-up run-pg test demo-report capture video evidence reset clean
