# dstate

[![npm version](https://img.shields.io/npm/v/dstate.svg)](https://www.npmjs.com/package/dstate)
[![Build Status](https://travis-ci.org/mappum/dstate.svg?branch=master)](https://travis-ci.org/mappum/dstate)
[![Dependency Status](https://david-dm.org/mappum/dstate.svg)](https://david-dm.org/mappum/dstate)

**Store changing state data as commits that can be rolled back**

`dstate` is used to save state data history in a LevelUP database as commit objects. Each commit is stored as a delta of the state, so you can efficiently store many commits.

## Usage

`npm install dstate`

```js
var DState = require('dstate')

// db is a levelup instance
var ds = new DState(db)

// commit some states
ds.commit({ foo: 'bar', baz: [ 0, 1, 2 ] })
ds.commit({ foo: 'bar2', baz: [ 1, 2, 3 ] })
ds.commit({ foo: 'bar3', baz: [ 2, 3, 4 ], lol: true })

// get current state
ds.getState((err, state) => { ... })

// roll back to first commit
ds.rollback(0)

// remove the first 2 commits
ds.prune(1)
```

----
#### `new DState(db)`

Creates a `DState` which stores data in `db`.

`db` should be a [`LevelUp`](https://github.com/Level/levelup) instance. The db should not be shared (if necessary, use [`level-sublevel`](https://github.com/dominictarr/level-sublevel) to create a sub-section of your db).

----
#### `state.commit(state, [opts], [callback])`

Creates a commit that changes the state to `state`.

`opts` may contain:
- `tx` [*Level Transaction*](https://github.com/cshum/level-transactions) (default: `null`) - If provided, the database operations for this commit will be made via `tx` (so consistency can be ensured with other db operations).

`callback` is called with `callback(err, index)` where `index` is a number representing the index of the commit that was made.

----
#### `state.rollback(index, [opts], [callback])`

Reverts the state to what is was in the commit with index `index`.

`index` should be a number, where `0` is the first commit, etc. It must be less than the index of the most recent commit.

`opts` may contain:
- `tx` [*Level Transaction*](https://github.com/cshum/level-transactions) (default: `null`) - If provided, the database operations for this commit will be made via `tx` (so consistency can be ensured with other db operations).

----
#### `state.getState(callback)`

Calls `callback(err, state)` with the current state. If no state has been committed yet, `state` will be `null`.

----
#### `state.getIndex(callback)`

Calls `callback(err, index)` with the latest commit index (a number, incrementing on each commit). If no state has been committed yet, `index` will be `null`.

----
#### `state.prune(index, [opts], [callback])`

Removes all the commits up to index `index` (inclusive). The state will not be able to be rolled back to the pruned commits.

`index` should be a number, where `0` is the first commit, etc. It must be less than the index of the most recent commit.

`opts` may contain:
- `tx` [*Level Transaction*](https://github.com/cshum/level-transactions) (default: `null`) - If provided, the database operations for this commit will be made via `tx` (so consistency can be ensured with other db operations).
