"use strict";

//This file contains the ES6 extensions to the core Promises/A+ API

var Promise = require("./core.js");

module.exports = Promise;

/* Static Functions */

var TRUE = valuePromise(true);
var FALSE = valuePromise(false);
var NULL = valuePromise(null);
var UNDEFINED = valuePromise(undefined);
var ZERO = valuePromise(0);
var EMPTYSTRING = valuePromise("");

function valuePromise(value) {
  var p = new Promise(Promise._noop);
  p._state = 1;
  p._value = value;
  return p;
}
Promise.resolve = function (value) {
  if (value instanceof Promise) return value;

  if (value === null) return NULL;
  if (value === undefined) return UNDEFINED;
  if (value === true) return TRUE;
  if (value === false) return FALSE;
  if (value === 0) return ZERO;
  if (value === "") return EMPTYSTRING;

  if (typeof value === "object" || typeof value === "function") {
    try {
      var then = value.then;
      if (typeof then === "function") {
        return new Promise(then.bind(value));
      }
    } catch (ex) {
      return new Promise(function (resolve, reject) {
        reject(ex);
      });
    }
  }
  //根据valuePromise返回一个新的promise try/catch 用于捕捉promise.resolve传入的val是否包含then方法
  return valuePromise(value);
};

Promise.all = function (arr) {
  //Array.prototype.slice.call(arguments);将函数的实际参数转换成数组的方法
  var args = Array.prototype.slice.call(arr);

  return new Promise(function (resolve, reject) {
    if (args.length === 0) return resolve([]);
    var remaining = args.length;
    function res(i, val) {
      if (val && (typeof val === "object" || typeof val === "function")) {
        if (val instanceof Promise && val.then === Promise.prototype.then) {
          //只有当Promise的状态为Fulfilled的时候，实例的value才会被正确的处理，否则会执行return，
          //所以只要有一个Promise未能成功Fulfilled都不会执行resolve(args)
          while (val._state === 3) {
            // _state等于3  证明val实例的值也是一个Promise实例,把val替换成新的Promise实例
            val = val._value;
          }
          // resolved成功调用，递归处理resolved的值
          if (val._state === 1) return res(i, val._value);
          if (val._state === 2) reject(val._value);
          // 处于padding状态时调用then方法并手动处理值
          val.then(function (val) {
            res(i, val);
          }, reject);
          return;
        } else {
          // 如果不是promise的实例且包含then方法
          var then = val.then;
          if (typeof then === "function") {
            var p = new Promise(then.bind(val));
            p.then(function (val) {
              res(i, val);
            }, reject);
            return;
          }
        }
      }
      //如果传进来的val（args的每一项）不是对象或者function的话，那么直接视为结果值把args[i]给替换掉
      args[i] = val;
      // promise.all里面全部为fulFilled状态后
      if (--remaining === 0) {
        resolve(args);
      }
    }
    for (var i = 0; i < args.length; i++) {
      res(i, args[i]);
    }
  });
};

Promise.reject = function (value) {
  return new Promise(function (resolve, reject) {
    reject(value);
  });
};
//当values中的任意一个子promise被成功或失败后，父promise马上也会
//用子promise的状态值作为参数调用父promise绑定的相应句柄，并返回该promise对象
Promise.race = function (values) {
  return new Promise(function (resolve, reject) {
    values.forEach(function (value) {
      Promise.resolve(value).then(resolve, reject);
    });
  });
};

/* Prototype Methods */

Promise.prototype["catch"] = function (onRejected) {
  return this.then(null, onRejected);
};
