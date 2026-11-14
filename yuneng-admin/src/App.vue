<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
import ThemePicker from "@/components/ThemePicker";

export default {
  name: "App",
  components: { ThemePicker },
  metaInfo() {
    return {
      title: (this.$store.state.settings.dynamicTitle && this.$store.state.settings.title) || process.env.VUE_APP_TITLE,
      titleTemplate: title => {
        const brandTitle = process.env.VUE_APP_TITLE
        return !title || title === brandTitle || title === '驭能智充' ? brandTitle : `${title} - 驭能智充`
      }
    }
  }
};
</script>
<style scoped>
#app .theme-picker {
  display: none;
}
</style>
