/* global describe, it, before, after */

const assert = require('assert').strict
const inquirer = require('inquirer')

const PouchDB = require('pouchdb')
PouchDB.plugin(require('.'))

const DOMAIN = process.env.DOMAIN || 'botsin.space'
const NAME = 'pouchdb-mastodon-test'

describe('pouchdb-mastodon', function () {
  before(async function () {
    this.db = new PouchDB('.test')
    await this.db.setupMastodon()
  })

  after(async function () {
    await this.db.destroy()
  })

  it('should get credentials', async function () {
    this.timeout(0)
    const scope = 'read write:statuses'
    const getCreds = async () => {
      const oauthUrl = await this.db.auth(DOMAIN, NAME, scope)
      console.log(`Go here to get the code: ${oauthUrl}`)
      const { code } = await inquirer.prompt([
        { type: 'password', name: 'code' }
      ])
      await this.db.access(DOMAIN, code, scope)
    }
    try {
      await this.db.access(DOMAIN)
    } catch {
      await getCreds()
    }
    await this.db.access(DOMAIN)
  })

  it('should download a timeline', async function () {
    this.timeout(0)
    await this.db.downloadMastoCollection(DOMAIN, 'timelines/public')
    const { rows } = await this.db.allDocs({ include_docs: true })
    assert.equal(rows[0].doc['timelines/public'], true)
  })

  it('should post', async function () {
    this.timeout(0)
    const result = await this.db.postStatus(DOMAIN, { status: 'hello world' })
    assert.equal(result.body.content, '<p>hello world</p>')
  })
})
