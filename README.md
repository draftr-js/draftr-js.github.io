# draftr.js

The tools for authoring IETF documents are terrible.  The [most modern "official" tool](http://xml.resource.org) requires lots of installation, just to let you write in XML.  Carsten's work on [kramdown-rfc2619](https://github.com/cabo/kramdown-rfc2629/) was a big improvement, using a much easier-to-use Markdown syntax.  But it still requires some twitchy ruby gem installation.  I made a [web-acessible version of kramdown-rfc2629](http://ipv.sx/draftr/), but it's not really scalable.

In order to provide a modern, webby toolkit for making Internet-drafts, draftr.js is an effort to implement parsing and rendering of the various I-D formats in Javascript, so that it's easy to incorporate into web apps.

## License

This project is licensed under the [MIT license](http://opensource.org/licenses/MIT).  If you submit a pull request to this repository, you indicate your agreement for your contributions in that pull request to be covered by that license.


## Quickstart

```
> git clone
> # Open index.html in a browser
```

Or just visit the [Github page](https://draftr-js.github.io/)


## TODO

* Support for more MD features
  * Definition lists
  * More elaborate lists
* MD rendering
* XML parsing
* XML rendering
* TXT parsing (approximate)
* Node.js support
