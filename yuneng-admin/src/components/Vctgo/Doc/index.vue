<template>
  <div>
    <svg-icon icon-class="question" @click="goto" />
  </div>
</template>

<script>
export default {
  name: 'VctgoDoc',
  data() {
    return {
      url: 'https://github.com/ifox-hu/YUNENG-ChargeOS/issues'
    }
  },
  methods: {
    goto() {
      window.open(this.url, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>
