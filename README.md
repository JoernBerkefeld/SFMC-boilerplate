# SFMC Boilerplate

bundle your scripts for Cloudpages easily and automated

## setup

For now, no npm package (TODO). Instead, please copy files and settings into your project:

- ``build.js`` --> copy to project root
- ``package.json`` --> copy ``"build": "node build.js"`` line into your package.json. Place it into the ``"scripts: {...}`` section
- go into the example folder ``cloudPages/demo-page`` and copy ``cloudpage.json``.

### cloudpage.json

The file is used to specify loading order and other details for compiling your code.

```json
{
	"author": "joern.berkefeld@gmail.com",
	"server": {
		"coreVersion": "1.1.1",
		"scriptAttributes": {
			"executioncontexttype": "post"
		},
		"dependencies": {
			"other": ["server/lib/lib.something.html"],
			"ssjs": ["server/lib/lib.ab.ssjs", "server/lib/lib.cd.ssjs"]
		},
		"src": ["server/server.ssjs"]
	},
	"public": ["public/index.html", "public/style.css", "public/app.js"],
	"dest": "dist/bundle.html"
}

``` 
| Parameter                     | Description                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| ``server.coreVersion``        | this is used to insert "Platform.Load("core", "x.x.x");" before any SSJS code                  |
| ``server.scriptAttributes``   | define any attributes you want to see on auto-inserted ``<script>`` tags for SSJS              |
| ``server.dependencies``       | put any re-usable libraries that you will not modifiy as part of the current app here          |
| ``server.dependencies.ssjs``  | all SSJS lib files; code will be wrapped in one single ``<script runat="server">...</script>`` |
| ``server.dependencies.other`` | any non-SSJS lib files (HTML, AMP, mixed); no wrapping code will be added                      |
