<template>
  <div
    class="sidebar-logo-container"
    :class="{ collapse: collapse }"
    :style="{
      backgroundColor:
        sideTheme === 'theme-dark'
          ? variables.menuBackground
          : variables.menuLightBackground,
    }"
  >
    <transition name="sidebarLogoFade">
      <router-link
        v-if="collapse"
        key="collapse"
        class="sidebar-logo-link"
        :aria-label="title"
        :title="title"
        to="/"
      >
        <img v-if="logo" :src="logo" class="sidebar-logo" alt="" />
        <h1
          v-else
          class="sidebar-title"
          :style="{
            color:
              sideTheme === 'theme-dark'
                ? variables.logoTitleColor
                : variables.logoLightTitleColor,
          }"
        >
          {{ title }}
        </h1>
      </router-link>
      <router-link v-else key="expand" class="sidebar-logo-link" :aria-label="title" :title="title" to="/">
        <img v-if="logo" :src="logo" class="sidebar-logo" alt="" />
        <h1
          class="sidebar-title"
          :style="{
            color:
              sideTheme === 'theme-dark'
                ? variables.logoTitleColor
                : variables.logoLightTitleColor,
          }"
        >
          {{ title }}
        </h1>
      </router-link>
    </transition>
  </div>
</template>

<script>
import { getInfo } from "@/api/login";
import logoImg from "@/assets/logo/yuneng.svg";
import variables from "@/assets/styles/variables.scss";

export default {
  name: "SidebarLogo",
  props: {
    collapse: {
      type: Boolean,
      required: true,
    },
  },
  computed: {
    variables() {
      return variables;
    },
    sideTheme() {
      return this.$store.state.settings.sideTheme;
    },
  },
  data() {
    return {
      title: '驭能智充',
      logo: logoImg,
    };
  },
  created() {
    getInfo().then((res) => {
      if (res.tenantName != "") {
        //this.title = res.tenantName;
        //后续添加租户自定义图标
        this.logo = logoImg;
      }
    });
  },
  metaInfo() {
    return {
      title: this.title,
    };
  },
};
</script>

<style lang="scss" scoped>
.sidebarLogoFade-enter-active,
.sidebarLogoFade-leave-active {
  transition: opacity .16s ease;
}

.sidebarLogoFade-enter,
.sidebarLogoFade-leave-to {
  opacity: 0;
}

/* Keep the brand layout above the generic #app .sidebar-container a rule. */
#app .sidebar-logo-container {
  position: relative;
  width: 100%;
  height: 50px;
  overflow: hidden;

  .sidebar-logo-link {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    height: 100%;
    padding: 0 20px;
    gap: 12px;
    text-align: left;
    white-space: nowrap;

    &:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: -3px;
      border-radius: 6px;
    }
  }

  .sidebar-logo {
    display: block;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    margin: 0;
    object-fit: contain;
  }

  .sidebar-title {
    flex: 0 1 auto;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: #142d53;
    font-family: inherit;
    font-size: 18px;
    font-weight: 600;
    line-height: 26px;
    letter-spacing: .5px;
    text-overflow: ellipsis;
  }

  &.collapse .sidebar-logo-link {
    justify-content: center;
    padding: 0;
    gap: 0;
  }
}
</style>
