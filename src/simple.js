//根据自己理解简化的promise版本
const PENDING = Symbol(),
  FULFILLED = Symbol(),
  REJECTED = Symbol(),
  ADOPTED = Symbol();

/**
 * 用class 的弊端，无法直接使用promise.resolve()必须通过new调用而原函数是可以的,而且new
 */
class mypromise {
  constructor(fn) {
    console.log(typeof this)
    if (typeof this !== "object") {
      throw new TypeError("Promise must be constructed via new");
    }
    if (typeof fn !== "function") {
      throw new TypeError("Promise must be a function");
    }
    this.resolvedCallbacks = [];
    this.rejectedCallbacks = [];
    this._deferredState = 0;
    this._state = PENDING;
    this._value = null;
    this._deferreds = null;

    fn(this.resolve, this.reject);
  }

  resolve(value) {
    //看到有些地方说这里要用箭头函数，因为被实例化之后会指向window，但是我觉得不对，实例化之后this不是指向的实例吗？
    if (this._state === PENDING) {
      this._state = FULFILLED;
      this._value = value;
      this.resolvedCallBacks.map((cb) => cb(value));
    }
  }
  reject(value) {
    if (this._state === PENDING) {
      this._state = REJECTED;
      this._value = value;
      this.rejectedCallBack.map((cb) => cb(value));
    }
  }
  then(onFulfilled, onRejected) {
    if (this._state === PENDING) {
      this.resolvedCallbacks.push(onFulfilled);
      this.rejectedCallbacks.push(onRejected);
    }
    if (this._state === FULFILLED) {
      onFulfilled(this._value);
    }
    if (this._state === REJECTED) {
      onRejected(this._value);
    }
  }
}

var a = new mypromise((resolve,reject)=>{
  resolve(5)
})