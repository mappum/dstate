var test = require('tape')
var level = require('levelup')
var memdown = require('memdown')
var DState = require('../')

function createDb () {
  return level({ db: memdown })
}

function assertState (t, ds, expectedState, expectedIndex) {
  t.test('assert state/index', function (t) {
    t.plan(4)
    ds.getState(function (err, actualState) {
      t.error(err, 'no error')
      t.deepEqual(actualState, expectedState, 'state is correct')
    })
    ds.getIndex(function (err, actualIndex) {
      t.error(err, 'no error')
      t.equal(actualIndex, expectedIndex, 'index is correct')
    })
  })
}

test('create DState', function (t) {
  t.test('normal constructor', function (t) {
    var ds = new DState(createDb())
    t.ok(ds instanceof DState, 'got DState')
    t.end()
  })
  t.test('constructor without "new"', function (t) {
    var ds = DState(createDb())
    t.ok(ds instanceof DState, 'got DState')
    t.end()
  })
  t.test('constructor without "db"', function (t) {
    try {
      var ds = new DState()
      t.notOk(ds, 'should have thrown')
    } catch (err) {
      t.ok(err, 'error thrown')
      t.equal(err.message, '"db" argument is required', 'correct error message')
    }
    t.end()
  })
})

test('simple usage', function (t) {
  var ds = new DState(createDb())

  t.test('initial state/index', function (t) {
    assertState(t, ds, null, null)
  })

  t.test('commits', function (t) {
    t.test('normal commit', function (t) {
      ds.commit({ abc: 123 }, function (err) {
        t.pass('cb called')
        t.error(err, 'no error')
        assertState(t, ds, { abc: 123 }, 0)
        t.end()
      })
    })
    t.test('second normal commit', function (t) {
      ds.commit({ abc: 456 }, function (err) {
        t.pass('cb called')
        t.error(err, 'no error')
        assertState(t, ds, { abc: 456 }, 1)
        t.end()
      })
    })
    t.test('non-object commit', function (t) {
      ds.commit(100, function (err) {
        t.pass('cb called')
        t.error(err, 'no error')
        assertState(t, ds, 100, 2)
        t.end()
      })
    })
    t.test('non-changing commit', function (t) {
      ds.commit(100, function (err) {
        t.pass('cb called')
        t.error(err, 'no error')
        assertState(t, ds, 100, 3)
        t.end()
      })
    })
    t.test('commit without callback', function (t) {
      ds.commit({ foo: 'bar' })
      setTimeout(function () {
        assertState(t, ds, { foo: 'bar' }, 4)
        t.end()
      }, 500)
    })
  })

  t.test('rollbacks', function (t) {
    t.test('normal rollback', function (t) {
      ds.rollback(3, function (err, state) {
        t.error(err, 'no error')
        t.equal(state, 100, 'correct state')
        assertState(t, ds, 100, 3)
        t.end()
      })
    })
    t.test('non-changing rollback', function (t) {
      ds.rollback(2, function (err, state) {
        t.error(err, 'no error')
        t.equal(state, 100, 'correct state')
        assertState(t, ds, 100, 2)
        t.end()
      })
    })
    t.test('out of bounds rollback', function (t) {
      ds.rollback(20, function (err, state) {
        t.ok(err, 'got error')
        t.equal(err.message, 'Index must be less than current index (2)', 'correct error message')
        t.notOk(state, 'no state')
        assertState(t, ds, 100, 2)
        t.end()
      })
    })
    t.test('rollback at current index', function (t) {
      ds.rollback(2, function (err, state) {
        t.ok(err, 'got error')
        t.equal(err.message, 'Index must be less than current index (2)', 'correct error message')
        t.notOk(state, 'no state')
        assertState(t, ds, 100, 2)
        t.end()
      })
    })
    t.test('rollback to beginning', function (t) {
      ds.rollback(0, function (err, state) {
        t.error(err, 'no error')
        t.deepEqual(state, { abc: 123 }, 'correct state')
        assertState(t, ds, { abc: 123 }, 0)
        t.end()
      })
    })
  })
})
