<template>
  <div>
    <svg-icon icon-class="github" @click="goto" />
  </div>
</template>

<script>
export default {
  name: 'VctgoGit',
  data() {
    return {
      url: 'https://github.com/ifox-hu/YUNENG-ChargeOS'
    }
  },
  methods: {
    goto() {
      window.open(this.url, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>
