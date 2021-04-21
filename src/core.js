'use strict'

//var asap = require('asap/raw')

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

//module.exports = Promise

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
Promise._onReject = null //这是什么？
Promise._noop = noop

Promise.prototype.then = function (onFulfilled, onRejected) {
  //接收两个参数resolve和reject函数
  if (this.constructor !== Promise) {
    //实例的构造函数是不是Promise(防止外部修改prototype.constructor)
    //直接修改prototype.constructor的意义何在？

    //实例化外部实例的构造函数并返回实例
    return safeThen(this, onFulfilled, onRejected)
  }
  //then 是会新建一个promise 的，所以是要同一条原型链下的一级then有多个 _deferredState才会为复数
  //创建一个空的Promise实例给res
  var res = new Promise(noop)
  handle(this, new Handler(onFulfilled, onRejected, res))
  // 每次then处理完之后返回一个新的promise实例
  return res
}

function safeThen(self, onFulfilled, onRejected) {
  return new self.constructor(function (resolve, reject) {
    //self.constructor外部实例的构造函数
    var res = new Promise(noop)
    res.then(resolve, reject)
    handle(self, new Handler(onFulfilled, onRejected, res))
  })
}
function handle(self, deferred) {
  while (self._state === 3) {
    //为什么是while 不是if？在这里是没有区别的啊
    // resolve传入的是promise的实例，this（上下文）则改成传入的promise实例
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

//链式调用
function handleResolved(self, deferred) {
  // asap(function () {
  //   var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected
  //   //如果then没有回调，则手动回调
  //   if (cb === null) {
  //     if (self._state === 1) {
  //       resolve(deferred.promise, self._value)
  //     } else {
  //       reject(deferred.promise, self._value)
  //     }
  //     return
  //   }
  //   //获取then的返回值，人后再次调用resolve，这样就完成了promise的链式调用
  //   var ret = tryCallOne(cb, self._value)
  //   if (ret === IS_ERROR) {
  //     reject(deferred.promise, LAST_ERROR)
  //   } else {
  //     resolve(deferred.promise, ret)
  //   }
  // })
  var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected
  //如果then没有回调，则手动回调
  if (cb === null) {
    if (self._state === 1) {
      resolve(deferred.promise, self._value)
    } else {
      reject(deferred.promise, self._value)
    }
    return
  }
  //获取then的返回值，人后再次调用resolve，这样就完成了promise的链式调用
  var ret = tryCallOne(cb, self._value)
  if (ret === IS_ERROR) {
    reject(deferred.promise, LAST_ERROR)
  } else {
    resolve(deferred.promise, ret)
  }
}
function resolve(self, newValue) {
  // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
  if (newValue === self) {
    // 防止resolve 的值传入实例本身
    return reject(
      self,
      new TypeError('A promise cannot be resolved with itself.')
    )
  }
  if (
    newValue &&
    (typeof newValue === 'object' || typeof newValue === 'function')
  ) {
    //obj.then
    var then = getThen(newValue)
    if (then === IS_ERROR) {
      return reject(self, LAST_ERROR)
    }
    if (then === self.then && newValue instanceof Promise) {
      //用于处理一个 Promise实例
      self._state = 3
      self._value = newValue
      finale(self)
      return
    } else if (typeof then === 'function') {
      //如果resolve传入的是Promise实例并且包含then方法则调用doResolve执行这个实例的构造函数
      // 把then当作构造函数并且把this指向这个then的对象
      doResolve(then.bind(newValue), self)
      return
    }
  }
  //若是普通值而不是promise实例
  //1：fulfilled
  self._state = 1
  self._value = newValue
  finale(self)
}

function reject(self, newValue) {
  // reject的时候状态变为2
  self._state = 2
  self._value = newValue
  if (Promise._onReject) {
    Promise._onReject(self, newValue)
  }
  finale(self)
}

//finale相当于handle的中转站，根据不同的情况调用handle方法
//_deferredState用来记录存储的实例状态
//同一个promise对象下，_deferredState的值是随着then调用次数决定的，self.then().then()不是同一个promise对象

function finale(self) {
  if (self._deferredState === 1) {
    //只调用一次
    handle(self, self._deferreds)
    self._deferreds = null
  }
  if (self._deferredState === 2) {
    //调用多次then 仅有调用self.then self.then时才会多个，单独的self.then().then()_deferredState还是为1

    for (var i = 0; i < self._deferreds.length; i++) {
      // 所以这里就决定了同一条promise原型链上的then任务的优先级在同一等级，而then().then()的或者then(Promise.resolve().then(()=>{console.log('1111-1')}))的优先级在之后
      handle(self, self._deferreds[i])
    }
    self._deferreds = null
  }
}

function Handler(onFulfilled, onRejected, promise) {
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
  this.onRejected = typeof onRejected === 'function' ? onRejected : null
  //
  this.promise = promise //将promise挂载到Handler实例的promise下
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
/*
 *
 * @param {*} fn
 * @param {*} promise=> this
 * fn实际就是promise初始化时的匿名函数(resolve,reject)=>{}
 * a和b则代表了resolve方法和reject方法
 */
function doResolve(fn, promise) {
  //done防止重复触发
  var done = false
  //tryCallTwo 用于处理并挂载resolve、reject方法
  //传入3个参数，Promise构造函数本身，resolve回调，reject回调
  var res = tryCallTwo(
    //fn(resolve,reject)
    fn,
    function (value) {
      //这个value从用户resolve传参拿到
      if (done) return
      done = true
      //处理resolve方法 所以使用代码里面在没有返回值时有没有resolve都不重要，在源码里面都会执行resolve或者reject
      resolve(promise, value)
    },
    function (reason) {
      //这个reason从用户reject传参拿到
      if (done) return
      done = true
      //处理reason
      reject(promise, reason)
    }
  )

  if (!done && res === IS_ERROR) {
    done = true
    reject(promise, LAST_ERROR)
  }
}
