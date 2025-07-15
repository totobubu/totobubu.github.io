<template>
  <div class="not-found-container">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>
      Sorry, we couldn't find the page.
    </p>
    <RouterLink to="/">
      <Button variant="text">Back to Home</Button>
    </RouterLink>
  </div>
</template>

<style scoped>
.not-found-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  height: 60vh; /* 화면 높이에 맞춰 중앙 정렬 */
}
h1 {
  font-size: 6rem;
  font-weight: bold;
  margin: 0;
  color: var(--primary-color);
}
h2 {
  font-size: 2rem;
  margin: 10px 0;
}
p {
  font-size: 1.2rem;
  color: var(--text-color-secondary);
}
</style>