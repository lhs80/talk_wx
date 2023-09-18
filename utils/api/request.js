/*
 * @Author: lzx
 * @Date: 2021-10-29 13:41:08
 * @LastEditors: lzx
 * @LastEditTime: 2021-10-29 13:49:05
 * @Description: Fuck Bug
 * @FilePath: \talk_vant\utils\api\request.js
 */
import { baseURL } from './config.js'
const log = require('../../log.js');
const curUserName = wx.getStorageSync('user').name || '';//未登录时没有姓名
export default function request(options){
  return new Promise((resolve, reject) => {
    wx.request({
    //这里使用到config.js的全局url地址
      url: baseURL + options.url,
      method: options.method || 'post',
      data: options.data || null,
      success (res) {
        log.info(`${curUserName} | 接口访问成功：${options.url}` + JSON.stringify(res.data));
        console.log(`${curUserName} | 接口访问成功：${options.url}` + JSON.stringify(res.data));
        switch (res.statusCode) {
          case 0:
          case 200:
            resolve(res);
            break;
          default:
            reject(res);
            break
        }
      },
      fail (err) {
        log.error(`${curUserName} | 接口访问失败：` + JSON.stringify(err));
        console.log(`${curUserName} | 接口访问失败：` + JSON.stringify(err));
        reject(err)
      },
    })
 })
}
