//根据自己理解简化的promise版本
const PENDING = Symbol(),
  FULFILLED = Symbol(),
  REJECTED = Symbol(),
  ADOPTED = Symbol()

/**
 * 用class 的弊端，无法直接使用promise.resolve()必须通过new调用而原函数是可以的
 */
function MyPromise(fn) {
  console.log(typeof this)
  if (typeof this !== 'object') {
    throw new TypeError('Promise must be constructed via new')
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Promise must be a function')
  }
  this.resolvedCallbacks = []
  this.rejectedCallbacks = []
  this._state = PENDING
  this._value = null //使用原型链传参

  fn(resolve, reject)

  function resolve(value) {
    if (this._state === PENDING) {
      this._state = FULFILLED
      this._value = value
      
      this.resolvedCallBacks.map((cb) => cb(value))
    }
  }
  function reject(value) {
    if (this._state === PENDING) {
      this._state = REJECTED
      this._value = value
      this.rejectedCallBack.map((cb) => cb(value))
    }
  }
}

MyPromise.prototype.then = function (onFulfilled, onRejected) {
  if (this._state === PENDING) {
    this.resolvedCallbacks.push(onFulfilled)
    this.rejectedCallbacks.push(onRejected)
  }
  if (this._state === FULFILLED) {
    onFulfilled(this._value)
  }
  if (this._state === REJECTED) {
    onRejected(this._value)
  }
}

var a = new MyPromise((resolve, reject) => {
  console.log(resolve)
  resolve(5)
})
