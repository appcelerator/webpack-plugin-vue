const path = require('path');
const { getOptions } = require('loader-utils');
const { registerTitaniumElements, TitaniumElementRegistry } = require('titanium-vdom');

const { camelize, capitalize, hyphenate } = require('./utils');

const elementRegistry = TitaniumElementRegistry.getInstance();
elementRegistry.defaultViewMetadata = {
	detached: false,
	model: {
		prop: 'value',
		event: 'change'
	}
};
registerTitaniumElements(elementRegistry);

module.exports = async function titaniumLoader(content, sourceMap) {
	this.async();
	this.cacheable();

	if (this.resourceQuery) {
		return this.callback(null, content, sourceMap);
	}

	const readFile = path => new Promise((resolve, reject) => {
		this.fs.readFile(path, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});

	const { diagnostics, compiler } = getOptions(this);
	const file = (await readFile(this.resourcePath)).toString('utf8');
	const component = compiler.parseComponent(file);
	if (component.template) {
		if (component.template.src) {
			const externalFile = (await new Promise((resolve, reject) =>
				this.resolve(path.dirname(this.resourcePath), component.template.src, (err, result) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				})
			));
			const externalContent = (await readFile(externalFile)).toString('utf8');
			component.template.content = externalContent;
		}
		if (component.template.lang === 'pug') {
			// TODO: handle pug templates
		}
		compiler.compile(component.template.content, {
			modules: [
				{
					postTransformNode: node => {
						const tag = node.tag;
						const possibleTagNames = [ hyphenate(tag), capitalize(camelize(tag)) ];
						for (const tagName of possibleTagNames) {
							if (elementRegistry.hasElement(tagName)) {
								const metadata = elementRegistry.getViewMetadata(tagName);
								const typeName = metadata.typeName;
								const lastDotIndex = metadata.typeName.lastIndexOf('.');
								const createFunctionSymbolName = typeName.slice(0, lastDotIndex + 1) + 'create' + typeName.slice(lastDotIndex + 1);
								diagnostics.recordApiUsage(this.resourcePath, createFunctionSymbolName);
							}
						}
					}
				}
			]
		});
	}

	this.callback(null, content, sourceMap);
};
