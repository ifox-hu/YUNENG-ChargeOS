import request from '@/utils/request'
import qs from 'qs'
import { getToken,getName } from '@/utils/auth'
//Statistics/getUsersAndSales

export function getManageTotalData(data) {
    return request({
        url: '/operator/total/getManageTotalData',
        method: 'post',
        data: data

    })
}
