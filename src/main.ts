import { createApp } from "vue";
import { createRouter, createWebHistory, RouterView } from "vue-router";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import CreateRoom from './components/CreateRoom.vue'
import JoinRoom from './components/JoinRoom.vue'
import Room from './components/Room.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "login",
      component: () => import("./components/Login.vue"),
    },
    {
      path: "/home",
      name: "home",
      component: () => import("./components/Home.vue"),
      meta: { requiresAuth: true }, // Mark as protected route
    },
    {
      path: '/create-room',
      name: 'CreateRoom',
      component: CreateRoom,
      meta: {requiresAuth: true}
    },
    {
      path: '/join-room',
      name: 'JoinRoom',
      component: JoinRoom,
      meta: {requiresAuth: true}
    },
    {
      path: '/room/:code',
      name: 'Room',
      component: Room,
      props: true,
      meta: {requiresAuth: true}
    },
    {
      path: "/gameplay",
      name: "gameplay",
      component: () => import("./components/Gameplay.vue"),
      meta: { requiresAuth: true }, // Mark as protected route
    },
  ],
});

const app = createApp(RouterView);

app.use(router);
app.use(GraffitiPlugin, {
  graffiti: new GraffitiDecentralized(), // stores log in data in browser
});

// Add navigation guard after plugins are installed
router.beforeEach((to, from, next) => {
  // Access the global $graffitiSession from the app instance
  const session = app.config.globalProperties.$graffitiSession.value;

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && session === null) {
    // Not logged in, redirect to login
    next({ name: 'login' });
  } else if (to.name === 'login' && session) {
    // Already logged in, redirect to home
    next({ name: 'home' });
  } else {
    // Allow navigation
    next();
  }
});

app.mount("#app");
