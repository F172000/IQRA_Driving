import React from "react";

export default function Auth(props) {
  return (
    <>
      {/* <Navbar transparent /> */}
      <main>
        <section className="relative w-full py-40 h-screen">
          <div
            className="absolute top-0 w-full h-full bg-blueGray-800 bg-no-repeat bg-full"
            style={{
              backgroundImage:
                "url(" + require("assets/img/register_bg_2.png").default + ")",
            }}
          ></div>
          {props.children}
          {/* <FooterSmall absolute /> */}
        </section>
      </main>
    </>
  );
}
