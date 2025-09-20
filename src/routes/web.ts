import express from 'express';
import path from 'path';

const router = express.Router();

// 测试EJS渲染
router.get('/test', (req, res) => {
  console.log('Views directory:', res.app.get('views'));
  console.log('View engine:', res.app.get('view engine'));
  res.send('Views path: ' + res.app.get('views'));
});

// 登录页面
router.get('/login', (req, res) => {
  try {
    console.log('尝试渲染登录页面，views路径:', res.app.get('views'));
    res.render('login', { 
      title: 'Point-Tron 管理系统登录',
      error: null 
    });
  } catch (error: any) {
    console.error('渲染登录页面失败:', error);
    res.status(500).send('Template rendering failed: ' + (error?.message || 'Unknown error'));
  }
});

// 管理后台首页
router.get('/admin', (req, res) => {
  try {
    console.log('尝试渲染管理后台页面，views路径:', res.app.get('views'));
    res.render('dashboard', { 
      title: 'Point-Tron 管理后台' 
    });
  } catch (error: any) {
    console.error('渲染管理后台页面失败:', error);
    res.status(500).send('Template rendering failed: ' + (error?.message || 'Unknown error'));
  }
});

// 兼容旧的区块页面路由，重定向到仪表盘
router.get('/admin/blocks', (req, res) => {
  res.redirect('/admin#blocks');
});

// K线图表页面
router.get('/kline', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../../public/kline.html'));
  } catch (error: any) {
    console.error('发送K线页面失败:', error);
    res.status(500).send('页面加载失败: ' + (error?.message || 'Unknown error'));
  }
});

// 重定向根路径到登录页
router.get('/', (req, res) => {
  res.redirect('/login');
});

export default router;