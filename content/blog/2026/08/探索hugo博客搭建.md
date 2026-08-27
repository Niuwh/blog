+++
date = '2026-08-24T15:18:15+08:00'
lastmod = '2026-08-25T15:18:15+08:00'
draft = false    
title = '探索hugo博客搭建'
description = "这里补充页面的描述，用于搜索引擎优化"
keywords = ["Hugo","教程"]
linktitle = "探索hugo博客搭建"
weight = "1"
tags = ["Hugo","Stack","博客搭建"]
categories = ["技术"]
+++

# 博客搭建基本教程
这是我使用hugo框架构建博客的一个经验，价值不大，因为市面上有更为详细且官方的指导性文件。我主要谈一下我对hugo项目本身的理解。

### 项目架构
```bash
my-site/
├── archetypes/     # 内容模板，每次使用hugo new <path>/file.md 会自动使用这个文件夹里面<path>.md的模板初始化
├── assets/         # 资源文件
├── content/        # 内容源文件，主要的文章，数据都在这里
├── data/           # 数据文件
├── layouts/        # 布局模板，可以预设一些模板，用于展示，可以覆盖theme上的布局
├── static/         # 静态文件（直接复制）
├── themes/         # 主题，其他开发者设计好的主题结构，可以直接配置使用
└── hugo.toml       # 配置文件，用于配置一些关键信息
```

### 项目基本命令
```bash
# 创建站点目录（替换 my-blog 为你的站点名称）
hugo new site 牛伟豪的博客
# 进入站点目录
cd 牛伟豪的博客
# 初始化 Git 仓库（后续主题部署需要）
git init
# 新建关于页
hugo new about.md
# 启动服务
hugo server
hugo server -D （带预览）
```

### 项目构建参考文档
我的项目地址也已经开源，地址：[https://github.com/Niuwh/blog](https://github.com/Niuwh/blog)
- [Hugo 静态网站构建实战手册](https://jimmysong.io/zh/book/hugo-handbook/)
- [stack 官方文档](https://stack.cai.im/zh/guide/getting-started)