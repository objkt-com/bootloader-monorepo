if (!Set.prototype.intersection){
    Set.prototype.intersection = function(set){
      if (this.size < set.size) return new Set([...this].filter(i => set.has(i)));
      return new Set([...set].filter(i => this.has(i)));
    }
  }
  if (!Set.prototype.union){
    Set.prototype.union = function(set){
      return new Set([...this, ...set]);
    }   
  }