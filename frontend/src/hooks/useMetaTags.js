import { useEffect } from "react";

export const useMetaTags = (metaData) => {
  useEffect(() => {
    if (!metaData) return;

    // Update document title
    if (metaData.title) {
      document.title = metaData.title;
    }

    // Helper function to update or create meta tag
    const updateMetaTag = (property, content, isProperty = false) => {
      if (!content) return;

      const attribute = isProperty ? "property" : "name";
      let meta = document.querySelector(`meta[${attribute}="${property}"]`);

      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attribute, property);
        document.head.appendChild(meta);
      }

      meta.setAttribute("content", content);
    };

    // Basic meta tags
    updateMetaTag("description", metaData.description);
    updateMetaTag("keywords", metaData.keywords);

    // Open Graph tags
    updateMetaTag("og:title", metaData.title, true);
    updateMetaTag("og:description", metaData.description, true);
    updateMetaTag("og:image", metaData.image, true);
    updateMetaTag("og:url", metaData.url, true);
    updateMetaTag("og:type", metaData.type || "website", true);
    updateMetaTag("og:site_name", "bootloader:", true);

    // Twitter Card tags
    updateMetaTag(
      "twitter:card",
      metaData.twitterCard || "summary_large_image"
    );
    updateMetaTag("twitter:title", metaData.title);
    updateMetaTag("twitter:description", metaData.description);
    updateMetaTag("twitter:image", metaData.image);
    updateMetaTag("twitter:site", "@bootloader_art");
    updateMetaTag("twitter:creator", metaData.twitterCreator);

    // Additional meta tags
    updateMetaTag("author", metaData.author);
    updateMetaTag("robots", metaData.robots || "index, follow");

    // Cleanup function to remove meta tags when component unmounts
    return () => {
      // We don't remove meta tags on cleanup as they should persist
      // until the next page sets new ones
    };
  }, [metaData]);
};

// Helper function to generate meta data for different page types
export const generateMetaTags = {
  home: () => ({
    title: "bootloader: - open experimental on-chain long-form generative art",
    description:
      "Create and mint on-chain long-form generative art on Tezos. Build algorithmic art generators with JavaScript and SVG that live forever on the blockchain.",
    keywords:
      "generative art, NFT, Tezos, on-chain, algorithmic art, SVG, JavaScript, blockchain art, digital art, crypto art",
    image: `${window.location.origin}/social.png`,
    url: window.location.href,
    type: "website",
  }),

  create: () => ({
    title: "Create Generator - bootloader:",
    description:
      "Create your own on-chain generative art generator using JavaScript and SVG. Build algorithmic art that lives forever on the Tezos blockchain.",
    keywords:
      "create generative art, NFT generator, Tezos, on-chain art, algorithmic art, SVG generator, JavaScript art",
    image: `${window.location.origin}/social.png`,
    url: window.location.href,
    type: "website",
  }),

  generator: (generator, authorDisplayInfo) => {
    const generatorName = generator.name || `Generator #${generator.id}`;
    const authorName =
      authorDisplayInfo?.displayName ||
      `${generator.author.slice(0, 6)}...${generator.author.slice(-4)}`;
    const description =
      generator.description ||
      `On-chain generative art generator "${generatorName}" by ${authorName}. Create unique algorithmic art pieces on the Tezos blockchain.`;

    return {
      title: `${generatorName} - bootloader:`,
      description:
        description.length > 160
          ? description.substring(0, 157) + "..."
          : description,
      keywords: `${generatorName}, generative art, NFT, Tezos, ${authorName}, on-chain art, algorithmic art`,
      image: `${window.location.origin}/generator-thumbnail/${generator.id}`,
      url: window.location.href,
      type: "article",
      author: authorName,
      twitterCreator: authorDisplayInfo?.profile?.twitter
        ? `@${authorDisplayInfo.profile.twitter.replace(/^@/, "")}`
        : undefined,
    };
  },

  profile: (address, userDisplayInfo, generatorCount, ownedCount) => {
    const displayName =
      userDisplayInfo?.displayName ||
      `${address.slice(0, 6)}...${address.slice(-4)}`;
    const description = `${displayName}'s profile on bootloader. ${generatorCount} generators created, ${ownedCount} tokens owned. Explore on-chain generative art on Tezos.`;

    return {
      title: `${displayName} - bootloader:`,
      description,
      keywords: `${displayName}, generative art, NFT, Tezos, profile, on-chain art, algorithmic art`,
      image: `${window.location.origin}/social.png`,
      url: window.location.href,
      type: "profile",
      author: displayName,
      twitterCreator: userDisplayInfo?.profile?.twitter
        ? `@${userDisplayInfo.profile.twitter.replace(/^@/, "")}`
        : undefined,
    };
  },
};
