/*
This example program downloads a list of your followers and accounts
that follow you, and prints a list of your mutuals. This is to
demonstrate the indexing capabilities of pouchdb-mastodon.

You can run the example like this:

```
$ node ./examples/mufos.js
```

By default, it attempts to authenticate against the `botsin.space`
instance. You can set that parameters like this:

```
$ DOMAIN=toot.cat ./examples/mufos.js
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
    let i = 0
    let next = this.downloadMastoCollection.bind(this, ...args)
    return new Promise((resolve) => {
      const id = setInterval(async () => {
        const result = await next()
        next = result.next
        if (!next) {
          console.log('Finished archiving.')
          clearInterval(id)
          resolve()
        } else {
          console.log(`Processing page ${++i} of ${args.join(' ')}`)
        }
      }, 5 * 1000)
    })
  }
})

const DOMAIN = process.env.DOMAIN || 'botsin.space'

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
  const account = await db.getAccount(DOMAIN)
  const p1 = db.archiveMastoCollection(DOMAIN, `accounts/${account.item.id}/followers`)
  const p2 = db.archiveMastoCollection(DOMAIN, `accounts/${account.item.id}/following`)
  console.log('Now syncing your connections...')
  await Promise.all([p1, p2])
  console.log('All synced.')
  const [{ rows: followers }, { rows: following }] = await Promise.all(['followers', 'following'].map((path) => {
    const group = `accounts/${account.item.id}/${path}`
    return db.query('queries/propGroup', {
      startkey: [group],
      endkey: [`${group}\uffff`],
      reduce: false,
      include_docs: true
    })
  }))
  const mutuals = followers.filter(({ id }) => {
    return following.filter(({ id: fid }) => {
      return id === fid
    }).length > 0
  }).map(({ doc }) => { return doc.item })
  if (mutuals.length === 0) {
    console.log('No mutuals.')
  } else {
    console.log('Mutuals:')
    mutuals.forEach((mutual) => {
      console.log(`- ${mutual.display_name} (${mutual.acct})`)
    })
  }
}).catch((error) => {
  console.error(error)
})
