import React, { useEffect, useState } from "react";
import axios from "axios";

const ExcelUploader = () => {
  const [fileList, setFileList] = useState<File[]>([]);
  const [upc, setUpc] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    // Clear stored data when the component loads (refresh)
    const clearPreviousSessionData = async () => {
      try {
        await axios.get(
          "http://localhost:3001/priceListParser/clearPriceLists"
        );
        console.log("Session data cleared.");
      } catch (error) {
        console.error("Error clearing session data:", error);
      }
    };

    clearPreviousSessionData();
  }, []);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFileList([...fileList, ...Array.from(e.target.files)]);
    }
  };

  // Remove a file from the list
  const handleRemoveFile = async (index: number) => {
    const removedFile = fileList[index];

    setFileList(fileList.filter((_, i) => i !== index));

    try {
      await axios.post(
        "http://localhost:3001/priceListParser/removePriceLists",
        {
          filename: removedFile.name,
        }
      );
      alert(`Removed data for file: ${removedFile.name}`);
    } catch (error) {
      console.error("Error removing file data:", error);
      alert("Failed to remove file data.");
    }
  };

  // Upload and process all Excel files
  const handleUpload = async () => {
    if (fileList.length === 0) {
      alert("Please select files to upload.");
      return;
    }

    const formData = new FormData();
    fileList.forEach((file) => {
      formData.append("files", file);
    });

    try {
      await axios.post(
        "http://localhost:3001/priceListParser/upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      alert("Files uploaded successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Error uploading files.");
    }
  };

  // Handle UPC search
  const handleSearch = async () => {
    if (!upc) {
      alert("Please enter a UPC to search.");
      return;
    }

    try {
      const response = await axios.get(
        `http://localhost:3001/priceListParser/search?upc=${upc}`
      );
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search failed:", error);
      alert("Error searching data.");
    }
  };

  return (
    <div>
      <h2>Excel File Upload and Search</h2>

      <input
        type="file"
        multiple
        accept=".xlsx,.xls"
        onChange={handleFileChange}
      />
      <button onClick={handleUpload}>Upload</button>

      <div>
        <h3>Uploaded Files:</h3>
        {fileList.length > 0 ? (
          <ul>
            {fileList.map((file, index) => (
              <li key={index}>
                {file.name}{" "}
                <button
                  onClick={() => handleRemoveFile(index)}
                  style={{ color: "red", marginLeft: "10px" }}
                >
                  X
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No files uploaded.</p>
        )}
      </div>

      <br />

      <input
        type="text"
        placeholder="Enter UPC to search"
        value={upc}
        onChange={(e) => setUpc(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>

      <div>
        <h3>Search Results:</h3>
        {searchResults.length > 0 ? (
          <ul>
            {searchResults.map((result, index) => (
              <li key={index}>
                <strong>UPC:</strong> {result.upc}
                <br />
                <strong>Item Details:</strong>
                <ul>
                  {Object.entries(result.data).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}:</strong> {value?.toString()}
                    </li>
                  ))}
                </ul>
                <strong>Source:</strong> {result.filename}
              </li>
            ))}
          </ul>
        ) : (
          <p>No results found.</p>
        )}
      </div>
    </div>
  );
};

export default ExcelUploader;
