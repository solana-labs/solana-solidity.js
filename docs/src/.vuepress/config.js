const { description } = require('../../package');

module.exports = {
    base: '/solana-solidity.js/',
    /**
     * Ref：https://v1.vuepress.vuejs.org/config/#title
     */
    title: 'Solana-Solidity.js',
    /**
     * Ref：https://v1.vuepress.vuejs.org/config/#description
     */
    description: description,

    /**
     * Extra tags to be injected to the page HTML `<head>`
     *
     * ref：https://v1.vuepress.vuejs.org/config/#head
     */
    head: [
        ['meta', { name: 'theme-color', content: '#3eaf7c' }],
        ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
        ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ],

    theme: 'default-prefers-color-scheme',

    /**
     * Theme configuration, here is the default theme configuration for VuePress.
     *
     * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
     */
    themeConfig: {
        repo: '',
        editLinks: false,
        docsDir: '',
        editLinkText: '',
        lastUpdated: false,
        sidebarDepth: 2,
        sidebar: [
            {
                collapsable: false,
                title: 'Getting Started',
                children: ['/getting-started/introduction', '/getting-started/setup'],
            },
            {
                collapsable: false,
                title: 'Examples',
                children: ['/examples/introduction', '/examples/erc20'],
            },
        ],

        nav: [
            {
                text: 'GitHub',
                link: 'https://github.com/solana-labs/solana-solidity.js',
            },
        ],
    },

    /**
     * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
     */
    plugins: ['dehydrate', '@vuepress/plugin-back-to-top', '@vuepress/plugin-medium-zoom'],
};
