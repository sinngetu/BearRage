import { Browser } from 'puppeteer'
import dayjs from 'dayjs'

import { getHash, deduplicate, model } from '../utils'
import { New } from '../interface'

import urls from './urls.json' assert { type: 'json' }

interface RawNew {
    isCN: boolean
    link: string
    title: string
}

const CNDomain = 'cn.wsj.com'
const MainDomain = 'www.wsj.com'

export default async function(browser: Browser) {
    const media = await model.media.getMedia()
    const CNMedium = media.reduce((result, medium) => CNDomain === medium.domain ? medium.id : result, 0)
    const MainMedium = media.reduce((result, medium) => MainDomain === medium.domain ? medium.id : result, 0)

    const news: RawNew[][] = await Promise.all(urls.map(async url => {
        const page = await browser.newPage()

        await page.goto(url, { timeout: 0, waitUntil: 'domcontentloaded' })

        const data = await page.evaluate(() => {
            const isCN = window.location.host === 'cn.wsj.com'
            const CNQuery = '.WSJTheme--headline--unZqjb45 a'
            const MainQuery = 'h3 a.css-1me4f21-HeadlineLink'

            return (Array.from(document.querySelectorAll(isCN ? CNQuery : MainQuery)) as HTMLLinkElement[]).map(a => ({
                isCN,
                link: a.href.split('?')[0],
                title: a.innerText
            }))
        })

        await page.close()
        return data
    }))

    let data: New[] = news.flat().map(({ isCN, link, title }) => ({
        link,
        title,
        medium: isCN ? CNMedium : MainMedium,
        hash: getHash(isCN ? CNMedium : MainMedium, link),
        date: dayjs().format('YYYY-MM-DD HH:mm:00'),
        tags: '',
        status: 0,
        keyword: '--',
    }))

    return await deduplicate(data)
}
