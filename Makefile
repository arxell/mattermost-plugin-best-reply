PLUGIN_ID := com.bestreply.plugin
PLUGIN_VERSION := 1.0.0
BUNDLE_NAME := $(PLUGIN_ID)-$(PLUGIN_VERSION).tar.gz

.PHONY: all webapp bundle dist clean check

all: dist

webapp:
	cd webapp && npm install
	cd webapp && npm run build

bundle:
	rm -rf dist/$(PLUGIN_ID)
	mkdir -p dist/$(PLUGIN_ID)/webapp/dist
	cp plugin.json dist/$(PLUGIN_ID)/
	cp -r webapp/dist dist/$(PLUGIN_ID)/webapp/
	cd dist && tar -czf $(BUNDLE_NAME) $(PLUGIN_ID)
	@echo "Plugin bundle: dist/$(BUNDLE_NAME)"

dist: webapp bundle

check:
	cd webapp && npm install
	cd webapp && npm run check

clean:
	rm -rf dist webapp/dist webapp/node_modules
