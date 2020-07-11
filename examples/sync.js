/*
This example program syncs a Mastodon collection, such as a timeline
or other list, with a PouchDB database. You can invoke it like this:

```
$ node ./examples/sync.js
```

By default, it attempts to authenticate against the `botsin.space`
instance and syncs the `timelines/home` endpoint. You can set
these parameters like this:

```
$ DOMAIN=toot.cat ./examples/sync.js timelines/public
```

If you haven't authenticated with the instance yet, the program
will instruct you on how to produce the appropriate credentials.
*/

const inquirer = require('inquirer')
const PouchDB = require('pouchdb')

PouchDB.plugin(require('..'))
PouchDB.plugin({
  // download toots from latest to earliest. halts once it has exhausted the past.
  archiveMastoCollection: async function (...args) {
    let next = this.downloadMastoCollection.bind(this, ...args)
    const id = setInterval(async () => {
      const result = await next()
      next = result.next
      if (!next) {
        console.log('Finished archiving.')
        clearInterval(id)
      }
    }, 5 * 1000) // every five seconds
    return clearInterval.bind(null, id) // simple cancel() method
  },
  // continuously download latest toots
  followMastoCollection: async function (...args) {
    const start = this.downloadMastoCollection.bind(this, ...args)
    let prev = start
    const id = setInterval(async () => {
      const result = await prev()
      prev = result.prev
      if (!prev) {
        console.log('All up to date. starting over...')
        prev = start
      }
    }, 30 * 1000) // every thirty seconds
    return clearInterval.bind(null, id) // simple cancel() method
  }
})

const DOMAIN = process.env.DOMAIN || 'botsin.space'
const PATH = process.argv[2] || 'timelines/home'

const storage = process.env.COUCH_URL ? `${process.env.COUCH_URL}/fedi-home` : '.mastodon'
const db = new PouchDB(storage)

// get the necessary credentials if not present. does nothing if auth'd.
const initialize = async () => {
  const getCreds = async () => {
    const oauthUrl = await db.auth(DOMAIN, 'pouchdb-mastodon')
    console.log(`Go here to get the code: ${oauthUrl}`)
    const { code } = await inquirer.prompt([
      { type: 'password', name: 'code' }
    ])
    await db.access(DOMAIN, code)
  }
  try {
    await db.access(DOMAIN)
  } catch {
    await getCreds()
  }
}

Promise.resolve().then(async () => {
  await db.setupMastodon()
  await initialize()
  console.log('Authenticated.')
  // downloads new posts as they appear
  db.followMastoCollection(DOMAIN, PATH)
  // download prior posts, all the way back to the beginning
  db.archiveMastoCollection(DOMAIN, PATH)
  console.log(`Now syncing ${PATH}`)
}).catch((error) => {
  console.error(error)
})
