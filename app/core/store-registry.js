class StoreRegistry {
  register(store) {
    this.store = store
  }

  getStore() {
    return this.store
  }
}

export default new StoreRegistry()
