import {
  guestbook_content,
  guestbook_messages,
} from '../pages/guestbook/guestbook.server.js';

export const PAGE_REGISTRY = {
  // Pages
  'page/index': 'pages/index/index.html',
  'page/cv': 'pages/cv/cv.html',
  'page/manifest': 'pages/manifest/manifest.html',
  'page/guestbook': 'pages/guestbook/guestbook.html',
  'page/404': 'pages/404/404.html',
  'page/500': 'pages/500/500.html',

  // Shared Components
  'shared/header': 'shared/header.html',
  'shared/footer': 'shared/footer.html',
  'shared/sidebar-left': 'shared/sidebar-left.html',
  'shared/sidebar-right': 'shared/sidebar-right.html',

  // Guestbook Components
  'guestbook/content': 'pages/guestbook/content.html',
  'guestbook/form': 'pages/guestbook/form.html',
  'guestbook/gate': 'pages/guestbook/gate.html',
  'guestbook/error': 'pages/guestbook/error.html',
  'guestbook/message': 'pages/guestbook/message.html',
  'guestbook/no_messages': 'pages/guestbook/no_messages.html',
};

export const DYNAMIC_REGISTRY = {
  // Logic Handler for Guestbook Content (Inner part)
  'guestbook/content': guestbook_content,
  'guestbook/messages': guestbook_messages,
};
