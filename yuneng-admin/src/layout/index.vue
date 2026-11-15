<template>
  <div :class="[classObj, { 'screen-layout': screenMode }]" class="app-wrapper" :style="{'--current-color': theme}">
      <div v-if="!screenMode&&device==='mobile'&&sidebar.opened" class="drawer-bg" @click="handleClickOutside"/>
      <sidebar v-if="!screenMode&&!sidebar.hide" class="sidebar-container"/>
      <div :class="{hasTagsView:needTagsView&&!screenMode,sidebarHide:sidebar.hide||screenMode}" class="main-container">
        <el-scrollbar>
          <div v-if="!screenMode" :class="{'fixed-header':fixedHeader}">
            <navbar/>
            <tags-view v-if="needTagsView"/>
          </div>
          <app-main/>
          <right-panel v-if="!screenMode">
            <settings/>
          </right-panel>
        </el-scrollbar>
      </div>
  </div>
</template>

<script>
import RightPanel from '@/components/RightPanel'
import { AppMain, Navbar, Settings, Sidebar, TagsView } from './components'
import ResizeMixin from './mixin/ResizeHandler'
import { mapState } from 'vuex'
import variables from '@/assets/styles/variables.scss'

export default {
  name: 'Layout',
  components: {
    AppMain,
    Navbar,
    RightPanel,
    Settings,
    Sidebar,
    TagsView
  },
  mixins: [ResizeMixin],
  computed: {
    screenMode() { return this.$route.matched.some(record => record.meta.fullscreen) },
    ...mapState({
      theme: state => state.settings.theme,
      sideTheme: state => state.settings.sideTheme,
      sidebar: state => state.app.sidebar,
      device: state => state.app.device,
      needTagsView: state => state.settings.tagsView,
      fixedHeader: state => state.settings.fixedHeader
    }),
    classObj() {
      return {
        hideSidebar: !this.sidebar.opened,
        openSidebar: this.sidebar.opened,
        withoutAnimation: this.sidebar.withoutAnimation,
        mobile: this.device === 'mobile'
      }
    },
    variables() {
      return variables;
    }
  },
  methods: {
    handleClickOutside() {
      this.$store.dispatch('app/closeSideBar', { withoutAnimation: false })
    }
  }
}
</script>

<style lang="scss" scoped>
  @import "~@/assets/styles/mixin.scss";
  @import "~@/assets/styles/variables.scss";

  .screen-layout > .main-container { margin-left: 0 !important; }

  .app-wrapper {
    @include clearfix;
    position: relative;
    height: 100%;
    width: 100%;

    .el-scrollbar{
      height: 100%;
    }

    ::v-deep .el-scrollbar__bar.is-vertical {
      z-index: 10;
    }

    ::v-deep .el-scrollbar__wrap {
      overflow-x: hidden;
    }

    &.mobile.openSidebar {
      position: fixed;
      top: 0;
    }
  }

  .drawer-bg {
    background: #000;
    opacity: 0.3;
    width: 100%;
    top: 0;
    height: 100%;
    position: absolute;
    z-index: 999;
  }

  .fixed-header {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 9;
    width: calc(100% - #{$base-sidebar-width});
    transition: width 0.28s;
  }

  .hideSidebar .fixed-header {
    width: calc(100% - 54px);
  }

  .sidebarHide .fixed-header {
    width: calc(100%);
  }

  .mobile .fixed-header {
    width: 100%;
  }
</style>
