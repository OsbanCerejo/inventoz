import React from "react";
import { useParams } from "react-router-dom";

function Search() {
  let { id } = useParams();
  return (
    <div>
      <p>Search item is </p>
      {id}
    </div>
  );
}

export default Search;
