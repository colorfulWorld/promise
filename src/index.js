'use strict'

module.exports = require('./core.js')
require('./done.js')
require('./finally.js')
require('./es6-extensions.js')
require('./node-extensions.js')
require('./synchronous.js')

/*1、promise对象初始状态为pending，在被resolve或reject时，状态变为Fulfilled或Rejected
 *2、resolve接收成功的数据，reject接收失败或错误的数据
 *3、Promise对象必须有一个then方法，且接受两个可变函数onFulfilled、onRejected
 */
