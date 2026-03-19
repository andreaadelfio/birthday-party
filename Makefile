PORT ?= 8002
HOST ?= 127.0.0.1
SITE_DIR ?= .

all: git

git:
	git add --all
	git commit -m "Updated website at $(shell date)"
	git push

dev:
	@echo "Avvio server su http://$(HOST):$(PORT)/index.html"
	python3 -m http.server "$(PORT)" --bind "$(HOST)" --directory "$(SITE_DIR)" >/dev/null 2>&1 &
	open "http://$(HOST):$(PORT)"

test-rsvp-select:
	node scripts/test-rsvp-select.mjs

smoke-rsvp-db:
	node scripts/smoke-supabase-rsvp.mjs

smoke-rsvp-write:
	node scripts/smoke-supabase-rsvp.mjs --write

stop:
	@if pkill -f "python3 -m http.server $(PORT)" 2>/dev/null; then \
		echo "Server fermato sulla porta $(PORT)"; \
	else \
		echo "Nessun server trovato sulla porta $(PORT)"; \
	fi
