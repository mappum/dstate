'use strict'

const EventEmitter = require('events')
const old = require('old')
const { encode, decode } = require('msgpack-lite')
const { diff, unpatch } = require('jsondiffpatch')
const transaction = require('level-transactions')
const clone = require('clone')

var dbOpts = { valueEncoding: 'binary' }

function nKey (n) {
  var buf = Buffer(4)
  buf.writeUInt32BE(n, 0)
  return buf
}

class DState extends EventEmitter {
  constructor (db) {
    super()
    if (!db) throw new Error('"db" argument is required')
    this.db = db
    this.state = null
    this.index = 0
    this.ready = false
    this._init()
  }

  commit (state, opts, cb) {
    if (!cb) {
      cb = opts
      opts = {}
    }
    cb = cb || this._error.bind(this)
    this._getTransaction(opts.tx, cb, (tx, done) => {
      var delta = diff(this.state, state)
      this._put(this.index, delta, tx, (err) => {
        if (err) return done(err)
        this._put('state', {
          state,
          index: this.index
        }, tx, (err) => {
          if (err) return done(err)
          this.state = clone(state)
          this.index += 1
          done(null, this.index)
        })
      })
    })
  }

  rollback (index, opts, cb) {
    if (!cb) {
      cb = opts
      opts = {}
    }
    cb = cb || this._error.bind(this)
    this._getTransaction(opts.tx, cb, (tx, cb) => {
      if (index >= this.index - 1) {
        return cb(new Error(
          `Index must be less than current index (${this.index - 1})`))
      }
      this._get(index, tx, (err, delta, found) => {
        if (err) return cb(err)
        if (!found) {
          let err = new Error(`Index ${index} is not in database`)
          err.notFound = true
          return cb(err)
        }
        var next = (i) => {
          this._get(i, tx, (err, delta, found) => {
            if (err) return cb(err)
            if (delta) this.state = unpatch(this.state, delta)
            tx.del(nKey(i), (err) => {
              if (err) return cb(err)
              if (i > index + 1) return next(i - 1)
              done()
            })
          })
        }
        var done = () => {
          this.index = index + 1
          this._put('state', {
            state: this.state,
            index: index + 1 },
          tx, (err) => cb(err, this.state))
        }
        next(this.index - 1)
      })
    })
  }

  prune (index, opts, cb) {
    if (!cb) {
      cb = opts
      opts = {}
    }
    cb = cb || this._error.bind(this)
    this._getTransaction(opts.tx, cb, (tx, cb) => {
      if (index >= this.index - 1) {
        return cb(new Error(
          `Index must be less than current index (${this.index - 1})`))
      }
      var next = (i) => {
        this._get(i, tx, (err, delta, found) => {
          if (err) return cb(err)
          if (!found) return cb()
          tx.del(nKey(i), (err) => {
            if (err) return cb(err)
            if (i === 0) return cb()
            next(i - 1)
          })
        })
      }
      next(index)
    })
  }

  getState (cb) {
    this.onceReady(() =>
      cb(null, clone(this.state)))
  }

  getIndex (cb) {
    this.onceReady(() =>
      cb(null, this.index === 0 ? null : this.index - 1))
  }

  _getTransaction (tx, cb, f) {
    this.onceReady(() => {
      if (tx) return f(tx, cb)
      tx = transaction(this.db)
      f(tx, (err, ...args) => {
        if (err) tx.rollback(err, () => cb(err))
        else tx.commit((err) => cb(err, ...args))
      })
    })
  }

  onceReady (f) {
    if (this.ready) f()
    else this.once('ready', f)
  }

  _init () {
    this._get('state', null, (err, data, found) => {
      if (err) return this._error(err)
      if (found) {
        this.index = data.index
        this.state = data.state
      }
      this.ready = true
      this.emit('ready')
    })
  }

  _error (err) {
    if (err) this.emit('error', err)
  }

  _get (key, tx, cb) {
    if (typeof key === 'number') key = nKey(key)
    var db = tx || this.db
    db.get(key, dbOpts, (err, value) => {
      if (err && !err.notFound) return cb(err)
      if (err && err.notFound) return cb(null, null, false)
      cb(null, decode(value), true)
    })
  }

  _put (key, value, tx, cb) {
    if (typeof key === 'number') key = nKey(key)
    var db = tx || this.db
    db.put(key, encode(value), dbOpts, cb)
  }
}

module.exports = old(DState)
