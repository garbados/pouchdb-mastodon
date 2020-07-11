# pouchdb-mastodon

[![Stability](https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)](https://nodejs.org/api/documentation.html#documentation_stability_index)
[![NPM Version](https://img.shields.io/npm/v/@garbados/pouchdb-mastodon.svg?style=flat-square)](https://www.npmjs.com/package/@garbados/pouchdb-mastodon)
[![JS Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

A plugin for [PouchDB](https://pouchdb.com/) that interacts with the [Mastodon](https://joinmastodon.org/) API.

## Why?

When you build an application for the [Fediverse](https://en.wikipedia.org/wiki/Fediverse), the first thing you have to do is authenticate with Oauth. This means saving some credentials, which means using a database. This plugin makes PouchDB that database, and provides a minimal API for requesting and storing data from an instance as well as for posting to it, as well as to make queries against it like "Show me all the posts in this timeline," or "Show me all the posts from this user."

The goal of this plugin is to make it easy to maintain copies of your Fediverse data and to make it easy to write your own Fediverse clients, without needing to operate an ActivityPub server. In fact, you can use pouchdb-mastodon in the browser to create offline-first serverless clients.

pouchdb-mastodon organizes data around the domain, assuming that one has only one account per domain. To get around this limitation, you can use a separate database for other accounts, and then replicate the two into a third. Clunky, I know. Patches welcome.

## Install

Use [NPM](https://www.npmjs.com/):

```bash
$ npm i -S @garbados/pouchdb-mastodon
```

## Usage

This plugin adds the following methods to a PouchDB instance:

### `async auth(domain, name, scopes = 'read') -> Promise(<string>)`

This method returns the URL a user must go to in order to retrieve the code used in the second step, `.access`. In a later version this will accept redirect URLs.

### `async access(domain, code, scopes = 'read') -> Promise(<null>)`

Given an authentication code, acquires an access token and associates it with the given `domain`. Subsequent requests will utilize this access token in the `Authorization` header.

### `async setupMastodon() -> Promise(<null>)`

Load the built-in design document, `_design/queries`.

### `async request(domain, url, body = null, headers = {}) -> Promise(<object>)`

Make an authenticated request of `domain` at the full or partial `url`, optionally setting the request body to `body` and using any specified `headers`. An `Authorization` header is automatically set, as well as a JSON response type. Returns `{ body, headers, next, prev }`.

- `body`: The JSON contents of the response body.
- `headers`: Response headers as an object.
- `next`: A string URL indicating the next (earlier) page of results.
- `prev`: A string URL indicating the prior (later) page of the results.

A common pattern is to feed `next` or `prev` back into `db.request` in order to page through a collection. An example of this can be found in `examples/sync.js`.

### `async mastoPost(domain, url, body, headers = {}) -> Promise(<object>)`

Make a POST request, such as to post a status or an attachment. Returns the server response as from `db.request`.

```js
const result = await this.db.mastoPost(DOMAIN, 'statuses', {
	status: 'hello world'
})
console.log(result.body.content)
>>> '<p>hello world</p>'
```

### `async postStatus(domain, body) -> Promise(<object>)`

A shortcut method to posting a status, as per [POST /api/v1/statuses](https://docs.joinmastodon.org/methods/statuses/). A similar shortcut for media is forthcoming.

### `async getAccount(domain) -> Promise(<object>)`

Returns the account associated with the given `domain`. The returns object's `item` property is a Mastodon [Account](https://docs.joinmastodon.org/entities/account/).

### `async downloadMastoCollection(domain, path, ...args) -> Promise(<object>)`

Fetches a page from a collection of items and stores each item in the database with an `_id` of `item.id`, usually an integer of some kind. If this process encounters collisions it will be altered.

## Usage, queries

This plugin adds a `_design/queries` design document during the execution of `setupMastodon` which PouchDB uses to index the information it downloads. You can query these indexes using [db.query](https://pouchdb.com/api.html#query_database).

Many of these queries operate on the concept of a `prop` which is short for a boolean property named for the URL fragment used to download the item. If an item is found multiple times over multiple requests, each fragment used to find it will be flagged on the item as a `prop`.

So, if you `db.downloadMastoCollection('toot.cat', 'timelines/home')`, items found this way will have `{ 'timelines/home': true }`.

### props

Find or count objects sorted by key. For example:

```js
const result = await db.query('queries/props', {
	key: 'timelines/home',
	reduce: false,
	include_docs: true
})
console.log(result)
>>> { "total_rows": 2, "offset": 1, "rows": [{...}] }
console.log(result.rows[0].doc)
>>> { "_id": "...", "_rev": "...", "timelines/home": true, item: {...} }
```

You can get a count of documents with a certain `prop` using the reduce function:

```js
const result = await db.query('queries/props', {
	key: 'timelines/home'
})
console.log(result)
>>> { "rows": [{ key: null, value: 42069 }] }
```

This index is useful for retrieving lists of things that do not need to be otherwise sorted, such as blocks or followers.

### propByTime

Find objects sorted by key and post time. For example:

```js
const result = await db.query('queries/propByTime', {
	startkey: ['timelines/home'],
	endkey: ['timelines/home\uffff']
})
```

This gives you results like querying `queries/props` without a reduce function, but sorts the results from earliest to latest. To get the most recent posts instead, use `descending=true`:

```js
const result = await db.query('queries/propByTime', {
	startkey: ['timelines/home\uffff'],
	endkey: ['timelines/home'],
	descending: true
})
```

This index is useful for information that should be sorted by time, such as timelines or moderation reports.

### byAccount

Find items associated with an account by their URL, sorted by post time. You can use this to build up a history of someone's activities from your perspective, or to simply find someone's latest post.

```js
const result = await db.query('queries/byAccount', {
	startkey: ['https://botsin.space/@animorphs'],
	endkey: ['https://botsin.space/@animorphs\uffff']
})
```

This retrieves all items associated with `@animorphs@botsin.space` sorted by time, like `propByTime`.

## Development

If you'd like to build with pouchdb-mastodon, I recommend you look at the `examples/` folder. It contains scripts for syncing timelines, and determining a list of "mufos".

## License

AGPL-3.0
