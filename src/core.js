'use strict'

var asap = require('asap/raw')

//定义空函数
function noop() {}

// States:
//
// 0 - pending
// 1 - fulfilled with _value
// 2 - rejected with _value
// 3 - adopted the state of another promise, _value
//
// once the state is no longer pending (0) it is immutable

// All `_` prefixed properties will be reduced to `_{random number}`
// at build time to obfuscate them and discourage their use.
// We don't use symbols or Object.defineProperty to fully hide them
// because the performance isn't good enough.

// to avoid using try/catch inside critical functions, we
// extract them to here.
var LAST_ERROR = null
var IS_ERROR = {} //用来存储错误信息

//获取实例的then
function getThen(obj) {
  try {
    return obj.then
  } catch (ex) {
    LAST_ERROR = ex
    return IS_ERROR
  }
}
//执行then方法回调
function tryCallOne(fn, a) {
  try {
    return fn(a)
  } catch (ex) {
    LAST_ERROR = ex
    return IS_ERROR
  }
}
//执行promise构造函数
function tryCallTwo(fn, a, b) {
  try {
    fn(a, b)
  } catch (ex) {
    LAST_ERROR = ex
    return IS_ERROR
  }
}

module.exports = Promise

//promise 构造函数
function Promise(fn) {
  if (typeof this !== 'object') {
    throw new TypeError('Promises must be constructed via new')
  }
  if (typeof fn !== 'function') {
    throw new TypeError("Promise constructor's argument is not a function")
  }
  // 存储的实例状态 0代表还未存储 1代表存储了1个 2代表存储了2个
  this._deferredState = 0
  // promise的状态 0 代表padding 1代表Fulfilled 2代表Rejected 3代表resolve传入promise实例
  this._state = 0
  //Fulfilled的值
  this._value = null
  //用来存储调用then后的实例
  this._deferreds = null
  if (fn === noop) return //这句是干嘛用的？
  // 处理Promise的参数
  doResolve(fn, this)
}
Promise._onHandle = null
Promise._onReject = null
Promise._noop = noop

Promise.prototype.then = function (onFulfilled, onRejected) {
  if (this.constructor !== Promise) {
    return safeThen(this, onFulfilled, onRejected)
  }
  var res = new Promise(noop)
  handle(this, new Handler(onFulfilled, onRejected, res))
  return res
}

function safeThen(self, onFulfilled, onRejected) {
  return new self.constructor(function (resolve, reject) {
    var res = new Promise(noop)
    res.then(resolve, reject)
    handle(self, new Handler(onFulfilled, onRejected, res))
  })
}
function handle(self, deferred) {
  while (self._state === 3) {
    self = self._value
  }
  if (Promise._onHandle) {
    Promise._onHandle(self)
  }
  if (self._state === 0) {
    if (self._deferredState === 0) {
      self._deferredState = 1
      self._deferreds = deferred
      return
    }
    if (self._deferredState === 1) {
      self._deferredState = 2
      self._deferreds = [self._deferreds, deferred]
      return
    }
    self._deferreds.push(deferred)
    return
  }
  handleResolved(self, deferred)
}

function handleResolved(self, deferred) {
  asap(function () {
    var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected
    if (cb === null) {
      if (self._state === 1) {
        resolve(deferred.promise, self._value)
      } else {
        reject(deferred.promise, self._value)
      }
      return
    }
    var ret = tryCallOne(cb, self._value)
    if (ret === IS_ERROR) {
      reject(deferred.promise, LAST_ERROR)
    } else {
      resolve(deferred.promise, ret)
    }
  })
}
function resolve(self, newValue) {
  // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
  if (newValue === self) {
    return reject(
      self,
      new TypeError('A promise cannot be resolved with itself.')
    )
  }
  if (
    newValue &&
    (typeof newValue === 'object' || typeof newValue === 'function')
  ) {
    var then = getThen(newValue)
    if (then === IS_ERROR) {
      return reject(self, LAST_ERROR)
    }
    if (then === self.then && newValue instanceof Promise) {
      self._state = 3
      self._value = newValue
      finale(self)
      return
    } else if (typeof then === 'function') {
      doResolve(then.bind(newValue), self)
      return
    }
  }
  self._state = 1
  self._value = newValue
  finale(self)
}

function reject(self, newValue) {
  self._state = 2
  self._value = newValue
  if (Promise._onReject) {
    Promise._onReject(self, newValue)
  }
  finale(self)
}
function finale(self) {
  if (self._deferredState === 1) {
    handle(self, self._deferreds)
    self._deferreds = null
  }
  if (self._deferredState === 2) {
    for (var i = 0; i < self._deferreds.length; i++) {
      handle(self, self._deferreds[i])
    }
    self._deferreds = null
  }
}

function Handler(onFulfilled, onRejected, promise) {
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
  this.onRejected = typeof onRejected === 'function' ? onRejected : null
  this.promise = promise
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, promise) {
  //done防止重复触发
  var done = false
  //tryCallTwo 用于处理并挂载resolve、reject方法
  //传入3个参数，Promise构造函数本身，resolve回调，reject回调
  var res = tryCallTwo(
    fn,
    function (value) {
      if (done) return
      done = true
      //处理resolve方法
      resolve(promise, value)
    },
    function (reason) {
      if (done) return
      done = true
      reject(promise, reason)
    }
  )
  if (!done && res === IS_ERROR) {
    done = true
    reject(promise, LAST_ERROR)
  }
}
