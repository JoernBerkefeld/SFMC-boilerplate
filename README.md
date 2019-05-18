# SFMC Boilerplate

bundle your scripts for Cloudpages & E-Mails easily and automated

[![NPM](https://nodei.co/npm/sfmc-boilerplate.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/sfmc-boilerplate/)


## Installation

```
$ npm install --save-dev sfmc-boilerplate
```

## Usage

run ``sfmc-build`` in the root of your project to see all available commands.


## Config files (email.json / cloudpage.json)

This required file is used to specify loading order and other details for compiling your code. Place it inside of each folder where you keep the source files for one email or one cloudpage.

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
| Parameter                     | Description                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ``server.coreVersion``        | this is used to insert "Platform.Load("core", "x.x.x");" before any SSJS code                                                     |
| ``server.scriptAttributes``   | define any attributes you want to see on auto-inserted ``<script>`` tags for SSJS                                                 |
| ``server.dependencies``       | put any re-usable libraries that you will not modifiy as part of the current app here                                             |
| ``server.dependencies.ssjs``  | all SSJS lib files; code will be wrapped in one single ``<script runat="server">...</script>``                                    |
| ``server.dependencies.other`` | any non-SSJS lib files (HTML, AMP, mixed); no wrapping code will be added                                                         |
| ``server.src``                | this is where your server-side app goes. You can use multipe files as well if needed                                              |
| ``public``                    | list your front end files here; any type is supported. JS & CSS will be autowrapped in their own ``<script>`` / ``<style>`` nodes |
| ``dest``                      | define the path and file name of your output file. The path is relative to the ``cloudpage.json``                                 |
